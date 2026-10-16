'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { avanzaComanda, portaComanda } from '@/comande/comande-repo'
import { prossimoStatoComanda, statoComandaValido } from '@/domain/comande'
import { idValido } from '@/tavoli/validazione'
import type { EsitoStaff } from './azioni'
const CONFLITTO = 'La comanda è già stata aggiornata da un altro schermo: controlla il suo stato attuale.'
async function operazione(fn: () => Promise<unknown>): Promise<EsitoStaff> {
  let risultato: unknown
  try { risultato = await fn() } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  if (!risultato) return { ok: false,errore: CONFLITTO }
  // Lo stato dell'ordine può cambiare: lo vedono anche telefoni al tavolo, conto e pagina del cliente da casa.
  revalidatePath('/staff'); revalidatePath('/staff/conto/[sessione]','page'); revalidatePath('/tavolo/[chiave]','page'); revalidatePath('/ordine/[token]','page')
  return { ok: true }
}
// `da`: lo stato mostrato sulla card toccata. Se nel frattempo è cambiato, la comanda non salta un passaggio.
export async function avanzaComandaStaff(id: string, da: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id) || !statoComandaValido(da) || !prossimoStatoComanda(da,'banco')) return { ok: false,errore: 'Comanda non valida.' }
  return operazione(() => avanzaComanda(db,id,da))
}
/** «Portate» dalla striscia «Da portare al tavolo». */
export async function portaComandaStaff(id: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id)) return { ok: false,errore: 'Comanda non valida.' }
  return operazione(() => portaComanda(db,id))
}
