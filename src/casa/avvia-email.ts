import 'server-only'
import { after } from 'next/server'
import { db } from '@/server/db'
import { smaltisciCodaEmail } from './coda-email'
/** Invia le email in coda dopo la risposta: un errore non tocca mai l'ordine né la pagina. */
export function avviaInvioEmail(): void {
  after(async () => {
    try { await smaltisciCodaEmail(db) } catch (err) { console.error('Invio email non riuscito:',err instanceof Error ? err.message : 'errore sconosciuto') }
  })
}
