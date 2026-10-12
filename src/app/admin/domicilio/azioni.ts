'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { aggiungiChiusura, aggiungiOrario, creaZona, rimuoviChiusura, rimuoviOrario, salvaImpostazioni, salvaZona } from '@/casa/impostazioni-repo'
import { validaChiusura, validaImpostazioni, validaOrario, validaZona } from '@/domain/valida-domicilio'
import { dataValida } from '@/domain/ora-roma'
import { idValido } from '@/tavoli/validazione'
export interface StatoModulo { errore: string | null; salvato: boolean; valori: Record<string,string> | null; invii: number }
export interface EsitoAdmin { ok: boolean; errore?: string }
function valori(fd: FormData): Record<string,string> {
  return Object.fromEntries([...fd.entries()].filter((e): e is [string,string] => typeof e[1] === 'string' && !e[0].startsWith('$')))
}
function rivalida() {
  revalidatePath('/admin/domicilio'); revalidatePath('/'); revalidatePath('/ordina'); revalidatePath('/staff')
}
// Salva con un controllo puro: l'errore del controllo o del DB torna nel modulo con i valori inseriti.
async function salvaModulo<T>(stato: StatoModulo, fd: FormData, controlla: (v: Record<string,string>) => { ok: true; dati: T } | { ok: false; errore: string }, salva: (dati: T) => Promise<unknown>): Promise<StatoModulo> {
  const v = valori(fd), invii = stato.invii + 1
  const esito = controlla(v)
  if (!esito.ok) return { errore: esito.errore,salvato: false,valori: v,invii }
  try { await salva(esito.dati) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Salvataggio non riuscito: controlla la connessione e riprova.',salvato: false,valori: v,invii }
  }
  rivalida()
  return { errore: null,salvato: true,valori: null,invii }
}
export async function salvaImpostazioniCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaImpostazioni,dati => salvaImpostazioni(db,dati))
}
export async function salvaZonaCasa(id: string | null, stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  if (id !== null && !idValido(id)) return { errore: 'Zona non valida.',salvato: false,valori: null,invii: stato.invii + 1 }
  return salvaModulo(stato,fd,validaZona,async dati => {
    if (id === null) await creaZona(db,dati)
    else if (!await salvaZona(db,id,dati)) throw new Error('zona non trovata')
  })
}
export async function aggiungiOrarioCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaOrario,dati => aggiungiOrario(db,dati))
}
export async function aggiungiChiusuraCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaChiusura,dati => aggiungiChiusura(db,dati.data,dati.motivo))
}
async function rimuovi(fn: () => Promise<boolean>): Promise<EsitoAdmin> {
  try { if (!await fn()) return { ok: false,errore: 'Già rimosso: aggiorna la pagina.' } } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  rivalida()
  return { ok: true }
}
export async function rimuoviOrarioCasa(id: string): Promise<EsitoAdmin> {
  await richiediRuolo('admin')
  if (!idValido(id)) return { ok: false,errore: 'Orario non valido.' }
  return rimuovi(() => rimuoviOrario(db,id))
}
export async function rimuoviChiusuraCasa(data: string): Promise<EsitoAdmin> {
  await richiediRuolo('admin')
  if (!dataValida(data)) return { ok: false,errore: 'Data non valida.' }
  return rimuovi(() => rimuoviChiusura(db,data))
}
