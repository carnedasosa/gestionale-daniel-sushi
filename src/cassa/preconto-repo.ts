import type { Db } from '@/server/db-tipi'
import { leggiConto } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
import { MAX_PERSONE } from '@/domain/divisione-conto'
import { bigliettoPreconto } from '@/stampa/biglietti'
import { stampanteDelLavoro } from '@/stampa/instradamento'

export type EsitoPreconto = 'ok' | 'vuoto' | 'non_disponibile'
/**
 * Accoda il pre-conto alla stampante della cassa e segna l'ora sulla sessione. `persone`: quota a persona sul residuo
 * (facoltativa). Va bene anche a tavolo chiuso (il cliente lo chiede spesso dopo).
 */
export async function accodaPreconto(db: Db, sessioneId: string, persone: number | null, adesso = new Date()): Promise<EsitoPreconto> {
  if (!idValido(sessioneId) || (persone !== null && (!Number.isSafeInteger(persone) || persone < 1 || persone > MAX_PERSONE))) return 'non_disponibile'
  return db.transazione(async tx => {
    const [s] = await tx.query('select id from sessioni_tavolo where id=$1 for update',[sessioneId])
    if (!s) return 'non_disponibile'
    const conto = await leggiConto(tx,sessioneId)
    if (!conto) return 'non_disponibile'
    if (!conto.voci.length && !conto.copertiCent) return 'vuoto'
    const [{ pagatoCent }] = await tx.query<{ pagatoCent: number }>('select coalesce(sum(importo_cent),0)::int as "pagatoCent" from pagamenti where sessione_id=$1 and annullato_il is null',[sessioneId])
    const documento = bigliettoPreconto({ ...conto,pagatoCent,persone },adesso)
    await tx.query(`insert into stampe (stampante,tipo,documento,sessione_id) values ($1,'preconto',$2::text::jsonb,$3)`,[stampanteDelLavoro('preconto'),JSON.stringify(documento),sessioneId])
    await tx.query('update sessioni_tavolo set preconto_il=clock_timestamp() where id=$1',[sessioneId])
    return 'ok'
  })
}
