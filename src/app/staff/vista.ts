import { schedePostazione, type Postazione, type SchedaStaff } from '@/domain/postazioni'
export type VistaStaff = SchedaStaff
/** Scheda dello schermo staff dall'indirizzo (`/staff?vista=…`); ordini se manca, non è valida o la postazione non la prevede. */
export function vistaStaff(v: unknown, postazione: Postazione = 'cassa'): VistaStaff {
  return (schedePostazione(postazione) as readonly unknown[]).includes(v) ? v as VistaStaff : 'ordini'
}
