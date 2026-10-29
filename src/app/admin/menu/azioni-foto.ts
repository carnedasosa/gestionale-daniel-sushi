'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { salvaFoto, togliFoto } from '@/menu/foto-repo'
import { MAX_BYTE_FOTO } from '@/domain/foto'
import { idValido } from '@/tavoli/validazione'
export type EsitoFotoAdmin = { ok: true } | { ok: false; errore: string }

function rivalida(id: string) {
  revalidatePath('/admin/menu'); revalidatePath(`/admin/menu/${id}`); revalidatePath('/'); revalidatePath('/ordina')
  revalidatePath('/tavolo/[chiave]','page'); revalidatePath('/staff','layout')
}
async function esegui(id: string, fn: () => Promise<EsitoFotoAdmin>): Promise<EsitoFotoAdmin> {
  let esito: EsitoFotoAdmin
  try { esito = await fn() } catch (err) {
    console.error('foto del piatto non salvata:', err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Salvataggio non riuscito: controlla la connessione e riprova.' }
  }
  if (esito.ok) rivalida(id)
  return esito
}

/** Foto già rimpicciolita dal browser: campo `foto` (file) più `larghezza` e `altezza` in pixel. */
export async function caricaFotoPiatto(id: string, fd: FormData): Promise<EsitoFotoAdmin> {
  await richiediRuolo('admin')
  const file = fd.get('foto'), larghezza = Number(fd.get('larghezza')), altezza = Number(fd.get('altezza'))
  if (!idValido(id) || !(file instanceof Blob)) return { ok: false,errore: 'Scegli una foto.' }
  if (file.size > MAX_BYTE_FOTO) return { ok: false,errore: 'La foto deve pesare al massimo 400 KB.' }
  const dati = new Uint8Array(await file.arrayBuffer())
  return esegui(id,async () => {
    const e = await salvaFoto(db,id,dati,larghezza,altezza)
    return e.ok ? { ok: true } : e
  })
}
export async function rimuoviFotoPiatto(id: string): Promise<EsitoFotoAdmin> {
  await richiediRuolo('admin')
  if (!idValido(id)) return { ok: false,errore: 'Piatto non valido.' }
  return esegui(id,async () => await togliFoto(db,id) ? { ok: true } : { ok: false,errore: 'Foto già tolta: aggiorna la pagina.' })
}
