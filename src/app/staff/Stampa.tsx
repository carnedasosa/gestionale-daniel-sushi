'use client'
/** Stampa il conto dal browser (barra, elenco e bottoni non escono in stampa). */
export function Stampa() {
  return <button type="button" className="b-btn b-btn--secondario" onClick={() => window.print()}>Stampa</button>
}
