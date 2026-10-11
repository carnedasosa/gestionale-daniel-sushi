'use server'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/server/db'
import { normalizzaCodice } from '@/domain/codice-tavolo'
import { bloccato, FINESTRA_MINUTI } from '@/domain/limiti-tentativi'
import { tavoloDaSlug, elencoTavoli, contaErrori, registraTentativoFallito, verificaCodice } from '@/tavoli/repo'
import { COOKIE_DISPOSITIVO, OPZIONI_COOKIE, nomeCookieTavolo, opzioniCookieTavolo } from '@/tavoli/cookie'
import { idValido, slugValido } from '@/tavoli/validazione'

export interface StatoCodice { errore: string | null }
// I Server Components possono leggere cookie, ma solo una Server Action può crearli.
export async function inizializzaDispositivo(): Promise<void> {
  const jar = await cookies()
  if (!idValido(jar.get(COOKIE_DISPOSITIVO)?.value)) jar.set(COOKIE_DISPOSITIVO,randomUUID(),{ ...OPZIONI_COOKIE, path: '/', maxAge: 365 * 24 * 60 * 60 })
}
export async function entraAlTavolo(slug: string, _stato: StatoCodice, fd: FormData): Promise<StatoCodice> {
  if (!slugValido(slug)) return { errore: 'Tavolo non trovato' }
  const jar = await cookies()
  let dispositivo = jar.get(COOKIE_DISPOSITIVO)?.value
  if (!idValido(dispositivo)) {
    dispositivo = randomUUID()
    jar.set(COOKIE_DISPOSITIVO,dispositivo,{ ...OPZIONI_COOKIE, path: '/', maxAge: 365 * 24 * 60 * 60 })
  }
  let sessioneId: string
  try {
    const tavolo = await tavoloDaSlug(db,slug)
    if (!tavolo) return { errore: 'Tavolo non trovato' }
    const aperto = (await elencoTavoli(db)).find(t => t.id === tavolo.id)?.sessione
    if (!aperto) return { errore: 'Il tavolo non è ancora aperto: chiedi al personale' }
    const errori = await contaErrori(db,tavolo.id,dispositivo,FINESTRA_MINUTI)
    if (bloccato(errori.dispositivo,errori.tavolo)) return { errore: 'Troppi tentativi, chiedi il codice al personale e riprova tra qualche minuto' }
    const input = fd.get('codice')
    const codice = typeof input === 'string' ? normalizzaCodice(input) : null
    const sessione = codice ? await verificaCodice(db,tavolo.id,codice) : null
    if (!sessione) {
      await registraTentativoFallito(db,tavolo.id,dispositivo)
      return { errore: 'Codice non corretto' }
    }
    sessioneId = sessione.id
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Accesso non riuscito: controlla la connessione e riprova.' }
  }
  jar.set(nomeCookieTavolo(slug),sessioneId,opzioniCookieTavolo(slug))
  redirect(`/tavolo/${slug}`)
}
