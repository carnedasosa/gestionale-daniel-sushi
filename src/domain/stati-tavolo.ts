export type StatoOrdineTavolo = 'inviato' | 'in_preparazione' | 'servito' | 'annullato'
export const STATI_TAVOLO: readonly StatoOrdineTavolo[] = ['inviato', 'in_preparazione', 'servito', 'annullato']
export function prossimoStato(s: StatoOrdineTavolo): StatoOrdineTavolo | null {
  return s === 'inviato' ? 'in_preparazione' : s === 'in_preparazione' ? 'servito' : null
}
export function puoAnnullare(s: StatoOrdineTavolo): boolean { return s === 'inviato' || s === 'in_preparazione' }
export function etichettaStato(s: StatoOrdineTavolo): string {
  return { inviato: 'Inviato', in_preparazione: 'In preparazione', servito: 'Servito', annullato: 'Annullato' }[s]
}
/** Ordini ancora in cucina di una sessione, dagli ordini attivi già letti dallo schermo staff. */
export function riassuntoTavolo(ordini: readonly { sessioneId: string; stato: string }[], sessioneId: string): { inCucina: number } {
  return { inCucina: ordini.filter(o => o.sessioneId === sessioneId && (o.stato === 'inviato' || o.stato === 'in_preparazione')).length }
}
