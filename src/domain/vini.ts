// Carta dei vini: i campi del vino stanno sul piatto, e la categoria di tipo «vini» li mostra raggruppati per tipologia.
export const TIPI_CATEGORIA = ['piatti','vini'] as const
export type TipoCategoria = typeof TIPI_CATEGORIA[number]
export const TIPOLOGIE_VINO = ['bollicine','bianco','rosato','rosso','dolce'] as const
export type TipologiaVino = typeof TIPOLOGIE_VINO[number]
export const ETICHETTA_TIPOLOGIA: Record<TipologiaVino,string> = { bollicine: 'Bollicine',bianco: 'Bianchi',rosato: 'Rosati',rosso: 'Rossi',dolce: 'Dolci e da dessert' }
export const FORMATI_VINO = ['bottiglia','mezza','calice'] as const
export type FormatoVino = typeof FORMATI_VINO[number]
export const ETICHETTA_FORMATO: Record<FormatoVino,string> = { bottiglia: 'Bottiglia 0,75 l',mezza: 'Mezza bottiglia 0,375 l',calice: 'Calice' }

export interface DatiVino { tipologia: TipologiaVino; formato: FormatoVino; cantina: string | null; denominazione: string | null; annata: number | null }
export interface InputVino { vinoTipologia: string; vinoFormato: string; vinoCantina: string; vinoDenominazione: string; vinoAnnata: string }
export type ErroriVino = Partial<Record<keyof InputVino,string>>

const tra = <T extends string>(v: string, valori: readonly T[]): v is T => (valori as readonly string[]).includes(v)
/** Campi del vino dal modulo: tipologia e formato obbligatori, il resto facoltativo. */
export function validaVino(i: InputVino, annoCorrente: number): { ok: true; vino: DatiVino } | { ok: false; errori: ErroriVino } {
  const errori: ErroriVino = {}
  const cantina = i.vinoCantina.trim(), denominazione = i.vinoDenominazione.trim(), annata = i.vinoAnnata.trim()
  if (!tra(i.vinoTipologia,TIPOLOGIE_VINO)) errori.vinoTipologia = 'Scegli la tipologia del vino'
  if (!tra(i.vinoFormato,FORMATI_VINO)) errori.vinoFormato = 'Scegli bottiglia, mezza o calice'
  if (cantina.length > 80) errori.vinoCantina = 'Massimo 80 caratteri'
  if (denominazione.length > 120) errori.vinoDenominazione = 'Massimo 120 caratteri'
  if (annata && (!/^\d{4}$/.test(annata) || +annata < 1900 || +annata > annoCorrente)) errori.vinoAnnata = `Un anno tra 1900 e ${annoCorrente}, oppure vuoto`
  if (Object.keys(errori).length) return { ok: false,errori }
  return { ok: true,vino: { tipologia: i.vinoTipologia as TipologiaVino,formato: i.vinoFormato as FormatoVino,cantina: cantina || null,denominazione: denominazione || null,annata: annata ? +annata : null } }
}

/** Riga descrittiva del vino nel menù: cantina · denominazione · annata (le parti che ci sono). */
export function testoVino(v: DatiVino): string {
  return [v.cantina,v.denominazione,v.annata ? String(v.annata) : null].filter(Boolean).join(' · ')
}

/** Vini raggruppati per tipologia, nell'ordine della carta; l'ordine interno resta quello di partenza. */
export function raggruppaVini<T extends { vino: DatiVino | null }>(voci: T[]): { tipologia: TipologiaVino | null; voci: T[] }[] {
  const gruppi: { tipologia: TipologiaVino | null; voci: T[] }[] = TIPOLOGIE_VINO.map(tipologia => ({ tipologia,voci: voci.filter(v => v.vino?.tipologia === tipologia) }))
  gruppi.push({ tipologia: null,voci: voci.filter(v => !v.vino) })
  return gruppi.filter(g => g.voci.length > 0)
}
