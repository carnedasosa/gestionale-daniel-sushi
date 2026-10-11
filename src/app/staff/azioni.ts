'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { apriSessione, chiudiSessione } from '@/tavoli/repo'
import { avanzaStato, annullaOrdine, annullaRiga } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
export interface EsitoStaff { ok: boolean; errore?: string; codice?: string }
async function operazione(fn: () => Promise<unknown>): Promise<EsitoStaff> {
  let risultato: unknown
  try { risultato = await fn() } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false, errore: 'Operazione non riuscita, riprova.' }
  }
  if (!risultato) return { ok: false, errore: 'Operazione non disponibile: aggiorna lo schermo.' }
  revalidatePath('/staff')
  revalidatePath('/staff/conto/[sessione]','page')
  revalidatePath('/tavolo/[slug]','page')
  return { ok: true }
}
export async function apriTavolo(tavoloId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(tavoloId)) return { ok: false, errore: 'Tavolo non valido.' }
  return operazione(() => apriSessione(db,tavoloId))
}
export async function chiudiTavolo(sessioneId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(sessioneId)) return { ok: false, errore: 'Sessione non valida.' }
  return operazione(() => chiudiSessione(db,sessioneId))
}
export async function avanzaOrdine(ordineId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(ordineId)) return { ok: false, errore: 'Ordine non valido.' }
  return operazione(() => avanzaStato(db,ordineId))
}
export async function annullaOrdineStaff(ordineId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(ordineId)) return { ok: false, errore: 'Ordine non valido.' }
  return operazione(() => annullaOrdine(db,ordineId))
}
export async function annullaRigaStaff(rigaId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(rigaId)) return { ok: false, errore: 'Riga non valida.' }
  return operazione(() => annullaRiga(db,rigaId))
}
