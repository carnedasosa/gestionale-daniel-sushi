'use server'
import { richiediRuolo } from '@/auth/sessione'
import { cambiaDisponibilitaPiatto, type EsitoDisponibilita } from '@/menu/cambia-disponibilita'

/** «Esaurito» dal tablet di sala: basta il ruolo staff, senza i poteri dell'admin su prezzi, tavoli e zone. */
export async function cambiaDisponibilitaStaff(id: string, disponibile: boolean): Promise<EsitoDisponibilita> {
  await richiediRuolo('staff')
  return cambiaDisponibilitaPiatto(id, disponibile)
}
