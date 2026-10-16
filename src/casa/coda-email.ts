import type { Db } from '@/server/db-tipi'
import { componiEmail } from '@/domain/email-ordini'
import { leggiImpostazioni } from './impostazioni-repo'
import { ordineCasaPerId } from './ordini-casa-repo'
import { MASSIMO_TENTATIVI_EMAIL, prendiEmailDaInviare, segnaErrore, segnaInviata, type EmailDaInviare } from './email-repo'
import { configEmail, inviaConResend } from './resend'
type Ambiente = Record<string,string | undefined>
/**
 * Registra l'errore; all'ultimo tentativo lo scrive anche nei log, perché quell'email non ripartirà più.
 * Nel log niente dati personali: numero d'ordine (o id, se l'ordine non c'è più) e l'errore, con gli indirizzi email mascherati.
 */
async function registraErrore(db: Db, e: EmailDaInviare, errore: string, numero: number | null): Promise<void> {
  await segnaErrore(db,e.id,errore)
  if (e.tentativi < MASSIMO_TENTATIVI_EMAIL) return
  const ordine = numero === null ? e.ordineId : `n. ${numero}`
  console.error(`Email ${e.tipo} dell'ordine ${ordine} non inviata dopo ${MASSIMO_TENTATIVI_EMAIL} tentativi: ${errore.replace(/[^\s<>"'@]+@[^\s<>"'@]+/g,'[email]')}`)
}
/** Invia le email in coda. Con le email spente (configurazione assente) non tocca la coda. */
export async function smaltisciCodaEmail(db: Db, env: Ambiente = process.env, fetchFn: typeof fetch = fetch): Promise<{ inviate: number; errori: number }> {
  const config = configEmail(env)
  if (!config) return { inviate: 0,errori: 0 }
  const da = await prendiEmailDaInviare(db)
  if (!da.length) return { inviate: 0,errori: 0 }
  const { telefono } = await leggiImpostazioni(db)
  let inviate = 0, errori = 0
  for (const e of da) {
    const o = await ordineCasaPerId(db,e.ordineId)
    if (!o || o.anonimizzato || !o.clienteEmail || !o.clienteNome) { await registraErrore(db,e,'Ordine non disponibile',o?.numero ?? null); errori++; continue }
    const email = componiEmail({ tipo: e.tipo,numero: o.numero,servizio: o.tipo,fascia: o.fascia,nome: o.clienteNome,totaleCent: o.totaleCent,consegnaCent: o.consegnaCent,zonaNome: o.zonaNome,
      indirizzo: o.indirizzo,pagamento: o.pagamento,motivoRifiuto: o.motivoRifiuto,righe: o.righe,link: `${config.origine}/ordine/${o.token}`,telefono })
    const esito = await inviaConResend(config,o.clienteEmail,email,e.id,fetchFn)
    if (esito.ok) { await segnaInviata(db,e.id); inviate++ } else { await registraErrore(db,e,esito.errore,o.numero); errori++ }
  }
  return { inviate,errori }
}
