import type { Centesimi } from './soldi'
import type { SceltePoke } from './poke'
// Divisione del conto, sempre a centesimi interi: la somma delle quote è esattamente il totale.

export const MAX_PERSONE = 50
export const METODI_PAGAMENTO = ['contanti','carta'] as const
export type MetodoPagamento = typeof METODI_PAGAMENTO[number]
export const ETICHETTA_METODO: Record<MetodoPagamento,string> = { contanti: 'Contanti',carta: 'Carta' }
export function metodoValido(v: unknown): v is MetodoPagamento {
  return typeof v === 'string' && (METODI_PAGAMENTO as readonly string[]).includes(v)
}

/** Quote alla romana: il resto in centesimi va alle prime quote (mai più di 1 centesimo di differenza). */
export function allaRomana(totaleCent: Centesimi, persone: number): Centesimi[] {
  if (!Number.isSafeInteger(totaleCent) || totaleCent < 0 || !Number.isSafeInteger(persone) || persone < 1 || persone > MAX_PERSONE) throw new RangeError('Divisione non valida')
  const base = Math.floor(totaleCent / persone), resto = totaleCent - base * persone
  return Array.from({ length: persone },(_,i) => base + (i < resto ? 1 : 0))
}

/** Voce del conto come la vede la divisione: le porzioni uguali (stesso piatto, prezzo e poke) stanno insieme. */
export interface VoceDivisibile { numero: number | null; nome: string; prezzoUnitCent: number; poke: SceltePoke | null; quantita: number }
/** Chiave stabile di una voce: la stessa con cui il conto raggruppa le righe. */
export function chiaveVoce(v: Pick<VoceDivisibile,'numero' | 'nome' | 'prezzoUnitCent' | 'poke'>): string {
  return JSON.stringify([v.numero,v.nome,v.prezzoUnitCent,v.poke])
}

export interface PorzioneScelta { chiave: string; quantita: number }
/** Porzioni e coperti già pagati «per piatti», sommati per voce. */
export interface GiaPagato { porzioni: Map<string,number>; coperti: number }
export function sommaPagati(dettagli: { porzioni: PorzioneScelta[]; coperti: number }[]): GiaPagato {
  const porzioni = new Map<string,number>()
  let coperti = 0
  for (const d of dettagli) {
    for (const p of d.porzioni) porzioni.set(p.chiave,(porzioni.get(p.chiave) ?? 0) + p.quantita)
    coperti += d.coperti
  }
  return { porzioni,coperti }
}

/** Porzioni ancora da pagare per voce (mai sotto zero: una voce annullata dopo il pagamento resta a zero). */
export function porzioniResidue(voci: VoceDivisibile[], pagato: GiaPagato): { chiave: string; residue: number }[] {
  return voci.map(v => ({ chiave: chiaveVoce(v),residue: Math.max(0,v.quantita - (pagato.porzioni.get(chiaveVoce(v)) ?? 0)) }))
}

export type EsitoPerPiatti = { ok: true; importoCent: Centesimi; porzioni: (PorzioneScelta & { nome: string; numero: number | null; prezzoUnitCent: number })[]; coperti: number } | { ok: false; errore: string }
/**
 * Quota «per piatti»: porzioni scelte (anche una sola delle tre di una voce) più i coperti scelti.
 * Rifiuta voci sconosciute, porzioni già pagate e scelte vuote. Le porzioni escono nell'ordine del conto.
 */
export function quotaPerPiatti(voci: VoceDivisibile[], conto: { coperti: number | null; copertoCent: number | null }, pagato: GiaPagato, scelte: PorzioneScelta[], coperti: number): EsitoPerPiatti {
  if (!Array.isArray(scelte) || !Number.isSafeInteger(coperti) || coperti < 0) return { ok: false,errore: 'Scelta non valida.' }
  const voluto = new Map<string,number>()
  for (const s of scelte) {
    if (!s || typeof s.chiave !== 'string' || !Number.isSafeInteger(s.quantita) || s.quantita < 0) return { ok: false,errore: 'Scelta non valida.' }
    voluto.set(s.chiave,(voluto.get(s.chiave) ?? 0) + s.quantita)
  }
  const chiavi = new Set(voci.map(chiaveVoce))
  if ([...voluto.keys()].some(k => !chiavi.has(k))) return { ok: false,errore: 'Il conto è cambiato: aggiorna la pagina.' }
  const residue = new Map(porzioniResidue(voci,pagato).map(r => [r.chiave,r.residue]))
  const porzioni: Extract<EsitoPerPiatti,{ ok: true }>['porzioni'] = []
  let importoCent = 0
  for (const v of voci) {
    const q = voluto.get(chiaveVoce(v)) ?? 0
    if (!q) continue
    if (q > residue.get(chiaveVoce(v))!) return { ok: false,errore: `${v.nome}: porzioni già pagate, aggiorna la pagina.` }
    porzioni.push({ chiave: chiaveVoce(v),quantita: q,nome: v.nome,numero: v.numero,prezzoUnitCent: v.prezzoUnitCent })
    importoCent += q * v.prezzoUnitCent
  }
  const copertiResidui = Math.max(0,(conto.coperti ?? 0) - pagato.coperti)
  if (coperti > copertiResidui) return { ok: false,errore: 'Coperti già pagati, aggiorna la pagina.' }
  importoCent += coperti * (conto.copertoCent ?? 0)
  if (!porzioni.length && !coperti) return { ok: false,errore: 'Scegli almeno un piatto.' }
  return { ok: true,importoCent,porzioni,coperti }
}
