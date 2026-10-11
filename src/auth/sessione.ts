import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { haAccesso, type Ruolo } from './regole'
import { leggiRuolo } from './ruoli-repo'

export async function utenteCorrente(): Promise<{ userId: string; ruolo: Ruolo | null } | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null
  return { userId, ruolo: await leggiRuolo(db, userId) }
}

// Da chiamare in ogni layout e in ogni azione server protetti.
export async function richiediRuolo(richiesto: Ruolo): Promise<{ userId: string; ruolo: Ruolo }> {
  const utente = await utenteCorrente()
  if (!utente) redirect('/accesso')
  if (!haAccesso(richiesto, utente.ruolo)) redirect('/accesso?errore=permessi')
  return { userId: utente.userId, ruolo: utente.ruolo! }
}
