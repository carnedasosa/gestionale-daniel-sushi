'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { impostaApertura } from '@/casa/impostazioni-repo'
import { accettaOrdine, annullaOrdineCasa, avanzaOrdineCasa, rifiutaOrdine } from '@/casa/ordini-casa-repo'
import { motivoRifiuto, STATI_CASA, type StatoCasa } from '@/domain/stati-casa'
import { dataRoma } from '@/domain/ora-roma'
import { idValido } from '@/tavoli/validazione'
import type { EsitoStaff } from './azioni'
// Le email accodate partono al rendering successivo di /staff (router.refresh dopo ogni azione).
async function operazione(fn: () => Promise<unknown>): Promise<EsitoStaff> {
  let risultato: unknown
  try { risultato = await fn() } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  if (risultato === null) return { ok: false,errore: 'Operazione non disponibile: aggiorna lo schermo.' }
  revalidatePath('/staff'); revalidatePath('/'); revalidatePath('/ordina'); revalidatePath('/ordine/[token]','page')
  return { ok: true }
}
export async function apriOrdiniOnline(): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return operazione(() => impostaApertura(db,dataRoma(new Date())))
}
export async function chiudiOrdiniOnline(): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return operazione(() => impostaApertura(db,null))
}
export async function accettaOrdineStaff(id: string, ritardo: number): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id) || (ritardo !== 0 && ritardo !== 15 && ritardo !== 30)) return { ok: false,errore: 'Ordine o ritardo non valido.' }
  return operazione(() => accettaOrdine(db,id,ritardo))
}
export async function rifiutaOrdineStaff(id: string, motivo: string, altro: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  const testo = motivoRifiuto(motivo,altro)
  if (!idValido(id)) return { ok: false,errore: 'Ordine non valido.' }
  if (!testo) return { ok: false,errore: 'Scegli un motivo, oppure scrivilo in «Altro».' }
  return operazione(() => rifiutaOrdine(db,id,testo))
}
export async function avanzaOrdineCasaStaff(id: string, da: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id) || !(STATI_CASA as readonly string[]).includes(da)) return { ok: false,errore: 'Ordine non valido.' }
  return operazione(() => avanzaOrdineCasa(db,id,da as StatoCasa))
}
export async function annullaOrdineCasaStaff(id: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id)) return { ok: false,errore: 'Ordine non valido.' }
  return operazione(() => annullaOrdineCasa(db,id))
}
