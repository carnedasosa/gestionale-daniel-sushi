export type VistaStaff = 'ordini' | 'tavoli' | 'conti'
/** Scheda dello schermo staff dall'indirizzo (`/staff?vista=…`); ordini se manca o non è valida. */
export function vistaStaff(v: unknown): VistaStaff {
  return v === 'tavoli' || v === 'conti' ? v : 'ordini'
}
