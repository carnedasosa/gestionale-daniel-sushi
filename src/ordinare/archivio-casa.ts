// Chiavi di localStorage degli ordini da casa (solo comodità del cliente: nulla di affidabile).
export const CHIAVE_CARRELLO_CASA = 'ds_carrello_casa'
export const CHIAVE_ULTIMO_ORDINE = 'ds_ultimo_ordine'
export const ORE_ORDINE_IN_CORSO = 12
export interface UltimoOrdine { token: string; numero: number; salvatoIl: number }
/** Ultimo ordine salvato nel browser, se valido e più recente di 12 ore. */
export function leggiUltimoOrdine(testo: string | null, adesso: number): UltimoOrdine | null {
  if (!testo) return null
  try {
    const v: unknown = JSON.parse(testo)
    if (!v || typeof v !== 'object') return null
    const { token,numero,salvatoIl } = v as Record<string,unknown>
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(token) || !Number.isSafeInteger(numero) || typeof salvatoIl !== 'number') return null
    if (adesso - salvatoIl > ORE_ORDINE_IN_CORSO * 3600000 || salvatoIl > adesso + 60000) return null
    return { token,numero: numero as number,salvatoIl }
  } catch { return null }
}
