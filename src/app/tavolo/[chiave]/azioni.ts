'use server'

import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/server/db'
import { erroreDiAttesa } from '@/server/db-adapter'
import { normalizzaCodice } from '@/domain/codice-tavolo'
import { bloccato, FINESTRA_MINUTI } from '@/domain/limiti-tentativi'
import { tavoloDaChiave, sessioneDelTavolo, contaErrori, registraTentativoFallito, verificaCodice, sessioneApertaPerId, sessionePerId } from '@/tavoli/repo'
import { ipDaHeaders } from '@/domain/ip-client'
import { creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { validaCarrello } from '@/domain/carrello'
import { COOKIE_DISPOSITIVO, OPZIONI_COOKIE, nomeCookieTavolo, opzioniCookieTavolo } from '@/tavoli/cookie'
import { idValido, chiaveValida } from '@/tavoli/validazione'
import type { EsitoInvio } from '@/ordinare/esito-invio'

export interface StatoCodice { errore: string | null }
// I Server Components possono leggere cookie, ma solo una Server Action può crearli.
export async function inizializzaDispositivo(): Promise<void> {
  const jar = await cookies()
  if (!idValido(jar.get(COOKIE_DISPOSITIVO)?.value)) jar.set(COOKIE_DISPOSITIVO,randomUUID(),{ ...OPZIONI_COOKIE, path: '/', maxAge: 365 * 24 * 60 * 60 })
}
export async function entraAlTavolo(chiave: string, _stato: StatoCodice, fd: FormData): Promise<StatoCodice> {
  if (!chiaveValida(chiave)) return { errore: 'Tavolo non trovato' }
  const jar = await cookies()
  const ip = ipDaHeaders(await headers())
  let dispositivo = jar.get(COOKIE_DISPOSITIVO)?.value
  if (!idValido(dispositivo)) {
    dispositivo = randomUUID()
    jar.set(COOKIE_DISPOSITIVO,dispositivo,{ ...OPZIONI_COOKIE, path: '/', maxAge: 365 * 24 * 60 * 60 })
  }
  let sessioneId: string
  try {
    const tavolo = await tavoloDaChiave(db,chiave)
    if (!tavolo) return { errore: 'Tavolo non trovato' }
    const esito = await db.transazione(async tx => {
      // Conteggio e registrazione si serializzano per tavolo anche tra dispositivi.
      await tx.query('select id from tavoli where id=$1 for update',[tavolo.id])
      const aperto = await sessioneDelTavolo(tx,tavolo.id)
      if (!aperto) return { errore: 'Il tavolo non è ancora aperto: chiedi al personale' }
      const errori = await contaErrori(tx,{ sessioneId: aperto.id,dispositivo: dispositivo!,ip,minuti: FINESTRA_MINUTI })
      if (bloccato(errori)) return { errore: 'Troppi tentativi, chiedi il codice al personale e riprova tra qualche minuto' }
      const input = fd.get('codice')
      const codice = typeof input === 'string' ? normalizzaCodice(input) : null
      const sessione = codice ? await verificaCodice(tx,tavolo.id,codice) : null
      if (!sessione) {
        await registraTentativoFallito(tx,{ tavoloId: tavolo.id,sessioneId: aperto.id,dispositivo: dispositivo!,ip })
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
  jar.set(nomeCookieTavolo(chiave),sessioneId,opzioniCookieTavolo(chiave))
  redirect(`/tavolo/${chiave}`)
}

async function sessioneAutorizzata(chiave: string) {
  if (!chiaveValida(chiave)) return null
  const id = (await cookies()).get(nomeCookieTavolo(chiave))?.value
  if (!idValido(id)) return null
  const sessione = await sessioneApertaPerId(db,id)
  return sessione?.tavoloChiave === chiave ? sessione : null
}
export async function pulisciCookieTavolo(chiave: string): Promise<void> {
  if (!chiaveValida(chiave)) return
  const jar = await cookies()
  const id = jar.get(nomeCookieTavolo(chiave))?.value
  if (!id) return
  const s = await sessionePerId(db,id)
  if (!s || s.chiusaIl || s.tavoloChiave !== chiave) jar.set(nomeCookieTavolo(chiave),'',{ ...opzioniCookieTavolo(chiave),maxAge: 0 })
}
export async function inviaOrdine(chiave: string, carrelloJson: string, chiaveInvio: string): Promise<EsitoInvio> {
  if (!idValido(chiaveInvio)) return { ok: false,errore: 'Chiave di invio non valida: ricarica il carrello e riprova.' }
  try {
    const sessione = await sessioneAutorizzata(chiave)
    if (!sessione) return { ok: false, errore: 'Il tavolo è stato chiuso: chiedi al personale' }
    if (typeof carrelloJson !== 'string' || carrelloJson.length > 100000) return { ok: false, errore: 'Carrello non valido.' }
    let input: unknown
    try { input = JSON.parse(carrelloJson) } catch { return { ok: false, errore: 'Carrello non valido: ricarica la pagina e riprova.' } }
    const carrello = validaCarrello(input)
    if (!carrello.ok) return carrello
    const esito = await creaOrdineTavolo(db,sessione.id,carrello.righe,chiaveInvio)
    return esito.ok ? { ok: true, numero: esito.ordine.numero } : esito
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    // Lock o istruzione scaduti: l'ordine non è partito (rollback) e la chiave di invio evita doppioni.
    if (erroreDiAttesa(err)) return { ok: false, errore: 'Il sistema è occupato, riprova tra qualche secondo.' }
    return { ok: false, errore: 'Invio non riuscito: controlla la connessione e riprova.' }
  }
}
