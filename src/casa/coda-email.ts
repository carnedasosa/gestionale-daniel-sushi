import type { Db } from '@/server/db-tipi'
import { componiEmail } from '@/domain/email-ordini'
import { leggiImpostazioni } from './impostazioni-repo'
import { ordineCasaPerId } from './ordini-casa-repo'
import { prendiEmailDaInviare, segnaErrore, segnaInviata } from './email-repo'
import { configEmail, inviaConResend } from './resend'
type Ambiente = Record<string,string | undefined>
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
    if (!o || o.anonimizzato || !o.clienteEmail || !o.clienteNome) { await segnaErrore(db,e.id,'Ordine non disponibile'); errori++; continue }
    const email = componiEmail({ tipo: e.tipo,numero: o.numero,servizio: o.tipo,fascia: o.fascia,nome: o.clienteNome,totaleCent: o.totaleCent,consegnaCent: o.consegnaCent,zonaNome: o.zonaNome,
      indirizzo: o.indirizzo,pagamento: o.pagamento,motivoRifiuto: o.motivoRifiuto,righe: o.righe,link: `${config.origine}/ordine/${o.token}`,telefono })
    const esito = await inviaConResend(config,o.clienteEmail,email,e.id,fetchFn)
    if (esito.ok) { await segnaInviata(db,e.id); inviate++ } else { await segnaErrore(db,e.id,esito.errore); errori++ }
  }
  return { inviate,errori }
}
