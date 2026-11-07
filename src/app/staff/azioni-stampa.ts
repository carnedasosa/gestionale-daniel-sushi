'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { archiviaLavoro, riprovaLavoro, ristampaOrdine } from '@/stampa/stampe-repo'
import { accodaPreconto } from '@/cassa/preconto-repo'
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

async function suLavoroInErrore(id: string, fn: (id: string) => Promise<boolean>): Promise<EsitoStaff> {
  if (!idValido(id)) return { ok: false,errore: 'Stampa non valida.' }
  try {
    if (!await fn(id)) return { ok: false,errore: 'Questa stampa non è più in errore: aggiorna la pagina.' }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  revalidatePath('/staff')
  return { ok: true }
}
/** Stampa non riuscita, stampante sistemata: di nuovo in coda, con i tentativi azzerati. */
export async function riprovaStampa(id: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return suLavoroInErrore(id,x => riprovaLavoro(db,x))
}
/** Stampa non riuscita che non serve più: non esce e non tiene acceso l'allarme. */
export async function ignoraStampa(id: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return suLavoroInErrore(id,x => archiviaLavoro(db,x))
}

/** Pre-conto alla stampante della cassa; `persone` aggiunge la quota a testa sul residuo. */
export async function stampaPreconto(sessioneId: string, persone: number | null): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(sessioneId) || (persone !== null && (!Number.isSafeInteger(persone) || persone < 1 || persone > 50))) return { ok: false,errore: 'Pre-conto non valido.' }
  let esito: Awaited<ReturnType<typeof accodaPreconto>>
  try { esito = await accodaPreconto(db,sessioneId,persone) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Pre-conto non stampato, riprova.' }
  }
  if (esito === 'vuoto') return { ok: false,errore: 'Il conto è vuoto: niente da stampare.' }
  if (esito !== 'ok') return { ok: false,errore: 'Conto non trovato: aggiorna la pagina.' }
  revalidatePath('/staff/conto/[sessione]','page')
  return { ok: true }
}
