'use server'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/server/db'
import { normalizzaCodice } from '@/domain/codice-tavolo'
import { bloccato, FINESTRA_MINUTI } from '@/domain/limiti-tentativi'
import { tavoloDaSlug, elencoTavoli, contaErrori, registraTentativoFallito, verificaCodice, sessioneApertaPerId } from '@/tavoli/repo'
import { creaOrdineTavolo, ordiniDellaSessione, type OrdineClient } from '@/tavoli/ordini-repo'
import { validaCarrello } from '@/domain/carrello'
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
    const esito = await db.transazione(async tx => {
      // Conteggio e registrazione si serializzano per tavolo anche tra dispositivi.
      await tx.query('select id from tavoli where id=$1 for update',[tavolo.id])
      const aperto = (await elencoTavoli(tx)).find(t => t.id === tavolo.id)?.sessione
      if (!aperto) return { errore: 'Il tavolo non è ancora aperto: chiedi al personale' }
      const errori = await contaErrori(tx,tavolo.id,dispositivo!,FINESTRA_MINUTI)
      if (bloccato(errori.dispositivo,errori.tavolo)) return { errore: 'Troppi tentativi, chiedi il codice al personale e riprova tra qualche minuto' }
      const input = fd.get('codice')
      const codice = typeof input === 'string' ? normalizzaCodice(input) : null
      const sessione = codice ? await verificaCodice(tx,tavolo.id,codice) : null
      if (!sessione) {
        await registraTentativoFallito(tx,tavolo.id,dispositivo!)
        return { errore: 'Codice non corretto' }
      }
      return { sessioneId: sessione.id }
    })
    if ('errore' in esito) return { errore: esito.errore! }
    sessioneId = esito.sessioneId
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Accesso non riuscito: controlla la connessione e riprova.' }
  }
  jar.set(nomeCookieTavolo(slug),sessioneId,opzioniCookieTavolo(slug))
  redirect(`/tavolo/${slug}`)
}

async function sessioneAutorizzata(slug: string) {
  if (!slugValido(slug)) return null
  const id = (await cookies()).get(nomeCookieTavolo(slug))?.value
  if (!idValido(id)) return null
  const sessione = await sessioneApertaPerId(db,id)
  return sessione?.tavoloSlug === slug ? sessione : null
}
export interface EsitoInvio { ok: boolean; errore?: string; nonDisponibili?: string[]; numero?: number }
export async function inviaOrdine(slug: string, carrelloJson: string): Promise<EsitoInvio> {
  try {
    const sessione = await sessioneAutorizzata(slug)
    if (!sessione) return { ok: false, errore: 'Il tavolo è stato chiuso: chiedi al personale' }
    if (typeof carrelloJson !== 'string' || carrelloJson.length > 100000) return { ok: false, errore: 'Carrello non valido.' }
    let input: unknown
    try { input = JSON.parse(carrelloJson) } catch { return { ok: false, errore: 'Carrello non valido: ricarica la pagina e riprova.' } }
    const carrello = validaCarrello(input)
    if (!carrello.ok) return carrello
    const esito = await creaOrdineTavolo(db,sessione.id,carrello.righe)
    return esito.ok ? { ok: true, numero: esito.ordine.numero } : esito
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false, errore: 'Invio non riuscito: controlla la connessione e riprova.' }
  }
}
export async function leggiOrdinatoFinora(slug: string): Promise<OrdineClient[]> {
  try {
    const sessione = await sessioneAutorizzata(slug)
    if (!sessione) return []
    return (await ordiniDellaSessione(db,sessione.id)).map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return []
  }
}
