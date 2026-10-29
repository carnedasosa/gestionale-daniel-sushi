import type { Centesimi } from './soldi'
// Coperti di un tavolo: facoltativi (null finché la sala non li segna), da 1 a 99.
export const MAX_COPERTI = 99
export const MAX_COPERTO_CENT = 2000

export function copertiValidi(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= MAX_COPERTI
}

/** Importo dei coperti: zero se non sono segnati o il coperto non si addebita. */
export function importoCoperti(coperti: number | null, copertoCent: number | null): Centesimi {
  return coperti && copertoCent ? coperti * copertoCent : 0
}
