'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { validaCarrello } from '@/domain/carrello'
import { validaCheckout } from '@/domain/checkout'
import { modalitaProva } from '@/domain/apertura-casa'
import { creaOrdineCasa } from '@/casa/ordini-casa-repo'
import type { EsitoCheckout } from '@/app/(cliente)/ordina/azioni'
/**
 * Ordine preso a voce dalla cassa (telefono o WhatsApp). `json`: `{ righe, dati, totaleVistoCent, chiaveInvio }` come dal sito,
 * ma senza email né privacy obbligatorie e con `dati.forzaFascia` per un orario già pieno. Nasce già accettato; nessuna email.
 */
export async function inviaOrdineCassa(json: string): Promise<EsitoCheckout> {
  await richiediRuolo('staff')
  if (typeof json !== 'string' || json.length > 100000) return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' }
  let input: unknown
  try { input = JSON.parse(json) } catch { return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' } }
  const v = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string,unknown> : {}
  const dati = validaCheckout(v.dati && typeof v.dati === 'object' && !Array.isArray(v.dati) ? v.dati as Record<string,unknown> : {},{ origine: 'cassa' })
  if (!dati.ok) return { ok: false,errore: 'Controlla i campi evidenziati.',errori: dati.errori }
  const carrello = validaCarrello(v.righe)
  if (!carrello.ok) return { ok: false,errore: carrello.errore }
  try {
    const esito = await creaOrdineCasa(db,{ righe: carrello.righe,dati: dati.dati,totaleVistoCent: v.totaleVistoCent as number,chiaveInvio: v.chiaveInvio as string,
      rete: null,adesso: new Date(),prova: modalitaProva(process.env),origine: 'cassa',forzaFascia: dati.forzaFascia })
    if (!esito.ok) {
      const { campo,ok,...resto } = esito
      return { ok,...resto,...(campo && campo !== 'carrello' ? { errori: { [campo]: esito.errore } } : {}) }
    }
    // L'ordine occupa una fascia: anche il sito deve vederla.
    revalidatePath('/staff'); revalidatePath('/'); revalidatePath('/ordina')
    return { ok: true,token: esito.ordine.token,numero: esito.ordine.numero }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' }
  }
}
