import type { Db } from '@/server/db-tipi'

/**
 * Annulli e scontrini. Un pagamento è «fiscalizzato» quando il suo scontrino è uscito, è in coda o è incerto: sono gli
 * stessi stati in cui `annullaPagamento` non lo lascia togliere, perché quei soldi risultano (o possono risultare) al
 * registratore. Dal gestionale il conto non può scendere sotto quella cifra: il reso si fa sul registratore.
 * I pagamenti senza scontrino non contano: lì un annullo lascia un «da restituire» che la cassa vede e sistema.
 */
export class SottoGliScontrini extends Error {
  constructor() { super('Annullo rifiutato: il conto scenderebbe sotto gli scontrini emessi') }
}
export const ERRORE_SCONTRINO_EMESSO = 'Lo scontrino è già uscito: così il conto scenderebbe sotto l’importo battuto. Il reso si fa sul registratore.'

async function fiscalizzatoCent(tx: Db, colonna: 'sessione_id' | 'ordine_id', id: string): Promise<number> {
  const [r] = await tx.query<{ cent: number }>(`select coalesce(sum(importo_cent),0)::float8 as cent from pagamenti
    where ${colonna}=$1 and annullato_il is null and scontrino in ('in_coda','emesso','incerto')`,[id])
  return r.cent
}
/**
 * Da chiamare dentro la transazione, dopo la modifica e con la sessione bloccata «for update» (incassi, richieste di
 * scontrino e altri annulli aspettano). Se il conto è sceso sotto il fiscalizzato lancia: la transazione torna indietro.
 * `totaleCent` si calcola solo se c'è almeno uno scontrino: sul percorso normale costa una query.
 */
export async function difendiScontriniConto(tx: Db, sessioneId: string, totaleCent: () => Promise<number>): Promise<void> {
  const fiscalizzato = await fiscalizzatoCent(tx,'sessione_id',sessioneId)
  if (fiscalizzato > 0 && await totaleCent() < fiscalizzato) throw new SottoGliScontrini()
}
/** Come sopra per un ordine da casa, con l'ordine bloccato «for update»: annullato o rifiutato vale zero. */
export async function difendiScontriniOrdine(tx: Db, ordineId: string): Promise<void> {
  const fiscalizzato = await fiscalizzatoCent(tx,'ordine_id',ordineId)
  if (fiscalizzato === 0) return
  const [o] = await tx.query<{ cent: number }>(`select case when stato in ('annullato','rifiutato') then 0 else totale_cent end as cent from ordini where id=$1`,[ordineId])
  if ((o?.cent ?? 0) < fiscalizzato) throw new SottoGliScontrini()
}
/** Attorno alla transazione: l'annullo rifiutato diventa l'esito `scontrino_emesso`, ogni altro errore prosegue. */
export async function senzaScendereSottoGliScontrini<T>(esegui: () => Promise<T>): Promise<T | 'scontrino_emesso'> {
  try { return await esegui() } catch (err) {
    if (err instanceof SottoGliScontrini) return 'scontrino_emesso'
    throw err
  }
}
