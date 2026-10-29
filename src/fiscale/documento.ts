import type { MetodoPagamento } from '@/domain/divisione-conto'
// Documento commerciale (lo «scontrino») come lo vuole un registratore telematico, senza dipendere dalla marca.
// Il gestionale non calcola l'IVA: ogni riga dice il reparto fiscale e l'aliquota la applica l'RT, dove è programmata.

export const MAX_DESCRIZIONE = 38 // lunghezza della descrizione di riga sugli RT Epson (printRecItem)
export const MAX_REPARTO_FISCALE = 99
export interface RigaFiscale { descrizione: string; quantita: number; prezzoUnitCent: number; reparto: number }
export interface DocumentoCommerciale {
  righe: RigaFiscale[]
  /** `indice`: posizione del pagamento elettronico programmata sull'RT (solo carta). */
  pagamento: { metodo: MetodoPagamento; importoCent: number; indice: number }
}
export const repartoFiscaleValido = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= MAX_REPARTO_FISCALE

/** Descrizione di riga: numero del menù davanti, accorciata alla lunghezza dell'RT, senza caratteri di controllo. */
export function descrizioneRiga(nome: string, numero: number | null = null): string {
  const t = `${numero !== null ? `${numero} ` : ''}${nome}`.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()
  return t.length > MAX_DESCRIZIONE ? `${t.slice(0,MAX_DESCRIZIONE - 1)}.` : t
}

export const totaleRighe = (righe: RigaFiscale[]) => righe.reduce((s,r) => s + r.quantita * r.prezzoUnitCent,0)

/**
 * Ripartisce `importo` tra i reparti in proporzione ai loro pesi, a centesimi interi, con il metodo dei resti maggiori:
 * la somma è sempre esattamente `importo`. Serve alle quote (romana, importo libero) quando nel conto ci sono reparti
 * con aliquote diverse: ogni reparto prende la sua parte e l'IVA resta giusta.
 */
export function ripartisci(importo: number, pesi: Map<number,number>): Map<number,number> {
  const voci = [...pesi].filter(([,p]) => p > 0).sort(([a],[b]) => a - b)
  const totale = voci.reduce((s,[,p]) => s + p,0)
  if (!voci.length || totale <= 0) throw new RangeError('Nessun reparto su cui ripartire')
  const parti = voci.map(([reparto,p]) => { const esatto = importo * p / totale; return { reparto,cent: Math.floor(esatto),resto: esatto - Math.floor(esatto) } })
  let mancano = importo - parti.reduce((s,x) => s + x.cent,0)
  for (const x of [...parti].sort((a,b) => b.resto - a.resto || a.reparto - b.reparto)) { if (mancano <= 0) break; x.cent++; mancano-- }
  return new Map(parti.filter(x => x.cent > 0).map(x => [x.reparto,x.cent]))
}

/** Righe di una quota (alla romana o importo libero): una per reparto fiscale, in proporzione al conto. */
export function righeQuota(importo: number, pesi: Map<number,number>, descrizione: string): RigaFiscale[] {
  return [...ripartisci(importo,pesi)].map(([reparto,cent]) => ({ descrizione: descrizioneRiga(descrizione),quantita: 1,prezzoUnitCent: cent,reparto }))
}

export type EsitoDocumento = { ok: true; documento: DocumentoCommerciale } | { ok: false; errore: string }
/** Controlli prima di mandarlo all'RT: righe valide e somma delle righe uguale al pagamento. */
export function verificaDocumento(d: DocumentoCommerciale): EsitoDocumento {
  if (!d.righe.length) return { ok: false,errore: 'Scontrino senza righe.' }
  for (const r of d.righe) {
    if (!r.descrizione || r.descrizione.length > MAX_DESCRIZIONE) return { ok: false,errore: 'Descrizione di riga non valida.' }
    if (!Number.isSafeInteger(r.quantita) || r.quantita < 1 || !Number.isSafeInteger(r.prezzoUnitCent) || r.prezzoUnitCent < 0 || !repartoFiscaleValido(r.reparto)) return { ok: false,errore: `Riga non valida: ${r.descrizione}` }
  }
  if (!Number.isSafeInteger(d.pagamento.importoCent) || d.pagamento.importoCent <= 0) return { ok: false,errore: 'Importo non valido.' }
  if (totaleRighe(d.righe) !== d.pagamento.importoCent) return { ok: false,errore: 'Le righe dello scontrino non tornano con l’importo pagato.' }
  return { ok: true,documento: d }
}
