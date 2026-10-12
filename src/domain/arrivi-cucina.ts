// Ordini della cucina già mostrati e ordini segnalati come nuovi ma non ancora letti.
export interface StatoArrivi { visti: string[]; nuovi: string[] }
const MASSIMO_ID = 500

/**
 * Confronta gli ordini in cucina con quelli già visti.
 * Con `prima` null (primo avvio in questa scheda) gli ordini presenti contano come già visti, senza suono.
 * Si conservano solo gli ordini ancora in cucina: uno servito o annullato non ci torna più.
 */
export function arriviCucina(prima: StatoArrivi | null, attuali: string[]): { stato: StatoArrivi; arrivati: string[] } {
  if (!prima) return { stato: { visti: [...attuali], nuovi: [] }, arrivati: [] }
  const visti = new Set(prima.visti), ancora = new Set(attuali)
  const arrivati = attuali.filter(id => !visti.has(id))
  return { stato: { visti: [...attuali], nuovi: [...prima.nuovi.filter(id => ancora.has(id)), ...arrivati] }, arrivati }
}

export function segnaLetto(stato: StatoArrivi, id: string): StatoArrivi {
  return { ...stato, nuovi: stato.nuovi.filter(x => x !== id) }
}

export function leggiStatoArrivi(testo: string | null): StatoArrivi | null {
  if (!testo) return null
  const lista = (x: unknown): x is string[] => Array.isArray(x) && x.length <= MASSIMO_ID && x.every(id => typeof id === 'string')
  try {
    const v: unknown = JSON.parse(testo)
    if (v && typeof v === 'object' && 'visti' in v && 'nuovi' in v && lista(v.visti) && lista(v.nuovi)) return { visti: v.visti, nuovi: v.nuovi }
  } catch { /* Valore illeggibile: si riparte come a inizio turno. */ }
  return null
}
