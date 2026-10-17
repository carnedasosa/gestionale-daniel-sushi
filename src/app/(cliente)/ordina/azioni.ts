'use server'
import { headers } from 'next/headers'
import { db } from '@/server/db'
import { erroreDiAttesa } from '@/server/db-adapter'
import { validaCarrello } from '@/domain/carrello'
import { validaCheckout, type ErroriCheckout } from '@/domain/checkout'
import { modalitaProva } from '@/domain/apertura-casa'
import { ipDaHeaders } from '@/domain/ip-client'
import { creaOrdineCasa } from '@/casa/ordini-casa-repo'
import { avviaInvioEmail } from '@/casa/avvia-email'
export interface EsitoCheckout {
  ok: boolean; token?: string; numero?: number; errore?: string; errori?: ErroriCheckout
  nonDisponibili?: string[]; nonDisponibiliIds?: string[]; fasce?: string[]; totaleCent?: number
}
/** Invio dell'ordine da casa. `json`: `{ righe, dati, totaleVistoCent, chiaveInvio }`; il server ricalcola tutto. */
export async function inviaOrdineCasa(json: string): Promise<EsitoCheckout> {
  if (typeof json !== 'string' || json.length > 100000) return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' }
  let input: unknown
  try { input = JSON.parse(json) } catch { return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' } }
  const v = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string,unknown> : {}
  const dati = validaCheckout(v.dati && typeof v.dati === 'object' && !Array.isArray(v.dati) ? v.dati as Record<string,unknown> : {})
  if (!dati.ok) return { ok: false,errore: 'Controlla i campi evidenziati.',errori: dati.errori }
  const carrello = validaCarrello(v.righe)
  if (!carrello.ok) return { ok: false,errore: carrello.errore }
  try {
    const esito = await creaOrdineCasa(db,{ righe: carrello.righe,dati: dati.dati,totaleVistoCent: v.totaleVistoCent as number,chiaveInvio: v.chiaveInvio as string,
      rete: ipDaHeaders(await headers()),adesso: new Date(),prova: modalitaProva(process.env) })
    if (!esito.ok) {
      const { campo,ok,...resto } = esito
      return { ok,...resto,...(campo && campo !== 'carrello' ? { errori: { [campo]: esito.errore } } : {}) }
    }
    avviaInvioEmail()
    return { ok: true,token: esito.ordine.token,numero: esito.ordine.numero }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    // Lock o istruzione scaduti (troppi invii insieme): la transazione è annullata, riprovare è sicuro.
    if (erroreDiAttesa(err)) return { ok: false,errore: 'Il sistema è occupato, riprova tra qualche secondo: se l’ordine era già arrivato non verrà duplicato.' }
    return { ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' }
  }
}
