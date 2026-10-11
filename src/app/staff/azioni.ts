'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { apriSessione, chiudiSessione, sbloccaSessione } from '@/tavoli/repo'
import { avanzaStato, annullaOrdine, annullaRiga, annullaVoceConto, type IdentitaVoce } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
export interface EsitoStaff { ok: boolean; errore?: string; codice?: string; avviso?: { motivo: 'ordini_in_cucina' | 'ordini_dopo_conto'; n: number } }
async function operazione(fn: () => Promise<unknown>): Promise<EsitoStaff> {
  let risultato: unknown
  try { risultato = await fn() } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false, errore: 'Operazione non riuscita, riprova.' }
  }
  if (!risultato) return { ok: false, errore: 'Operazione non disponibile: aggiorna lo schermo.' }
  revalidatePath('/staff')
  revalidatePath('/staff/conto/[sessione]','page')
  revalidatePath('/tavolo/[chiave]','page')
  return { ok: true }
}
export async function apriTavolo(tavoloId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(tavoloId)) return { ok: false, errore: 'Tavolo non valido.' }
  return operazione(() => apriSessione(db,tavoloId))
}
export async function sbloccaTavolo(sessioneId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(sessioneId)) return { ok: false,errore: 'Sessione non valida.' }
  return operazione(() => sbloccaSessione(db,sessioneId))
}
export async function chiudiTavolo(sessioneId: string,contoVistoAlle: string | null = null,forza = false): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  const data = typeof contoVistoAlle==='string' ? new Date(contoVistoAlle) : null
  if (!idValido(sessioneId) || typeof forza!=='boolean' || (contoVistoAlle!==null && (!data || !Number.isFinite(data.getTime())))) return { ok: false, errore: 'Sessione o data del conto non valida.' }
  try {
    const e = await chiudiSessione(db,sessioneId,data,forza)
    if (!e.ok) return e.motivo==='sessione_non_valida' ? { ok: false,errore: 'Sessione non valida.' } : { ok: false,avviso: { motivo: e.motivo,n: e.n } }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  revalidatePath('/staff'); revalidatePath('/staff/conto/[sessione]','page'); revalidatePath('/tavolo/[chiave]','page')
  return { ok: true }
}
export async function annullaVoceStaff(sessioneId: string,voce: IdentitaVoce): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(sessioneId)) return { ok: false,errore: 'Sessione non valida.' }
  return operazione(() => annullaVoceConto(db,sessioneId,voce))
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
