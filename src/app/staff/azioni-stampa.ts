'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { ristampaOrdine } from '@/stampa/stampe-repo'
import { idValido } from '@/tavoli/validazione'
import type { EsitoStaff } from './azioni'

/** Ristampa le comande dei reparti su carta per un ordine (carta finita, biglietto perso). */
export async function ristampaComande(ordineId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(ordineId)) return { ok: false,errore: 'Ordine non valido.' }
  let n: number
  try { n = await ristampaOrdine(db,ordineId) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Ristampa non riuscita, riprova.' }
  }
  if (!n) return { ok: false,errore: 'Niente da ristampare: nessun reparto di questo ordine lavora su carta.' }
  revalidatePath('/staff')
  return { ok: true }
}
