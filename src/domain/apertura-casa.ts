import type { Servizio } from './fasce'
export type MotivoChiusura = 'allergeni' | 'telefono' | 'spenti' | 'chiusura' | 'zone' | 'fasce'
export interface DatiApertura {
  allergeniCompleti: boolean; telefono: string | null; apertiIl: string | null; oggi: string
  chiusoOggi: boolean; zoneAttive: number; fasceLibere: number; prova: boolean
}
export type StatoApertura = { aperto: true } | { aperto: false; motivo: MotivoChiusura }
export const TESTO_MOTIVO: Record<MotivoChiusura,string> = {
  allergeni: 'Stiamo aggiornando le informazioni sugli allergeni: gli ordini online riapriranno presto.',
  telefono: 'Ordini online non ancora attivi.',
  spenti: 'Ordini online chiusi in questo momento.',
  chiusura: 'Oggi siamo chiusi.',
  zone: 'Consegne a domicilio non disponibili.',
  fasce: 'Nessuna fascia libera per oggi.',
}
/** Primo motivo per cui il servizio è chiuso, nell'ordine della spec (§5.1). */
export function aperturaServizio(servizio: Servizio, d: DatiApertura): StatoApertura {
  if (!d.allergeniCompleti && !d.prova) return { aperto: false,motivo: 'allergeni' }
  if (!d.telefono) return { aperto: false,motivo: 'telefono' }
  if (d.apertiIl !== d.oggi) return { aperto: false,motivo: 'spenti' }
  if (d.chiusoOggi) return { aperto: false,motivo: 'chiusura' }
  if (servizio === 'domicilio' && d.zoneAttive === 0) return { aperto: false,motivo: 'zone' }
  if (d.fasceLibere === 0) return { aperto: false,motivo: 'fasce' }
  return { aperto: true }
}
/** Prova in locale senza allergeni confermati: mai in produzione. */
export function modalitaProva(env: { NODE_ENV?: string; ORDINI_CASA_PROVA?: string }): boolean {
  return env.ORDINI_CASA_PROVA === '1' && env.NODE_ENV !== 'production'
}
