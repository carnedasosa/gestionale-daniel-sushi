'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { destinazioneDopoLogin } from '@/auth/regole'
import { leggiRuolo } from '@/auth/ruoli-repo'

export type StatoAccesso = { errore: string | null }

export async function entra(_stato: StatoAccesso, formData: FormData): Promise<StatoAccesso> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')
  if (!email || !password) return { errore: 'Inserisci email e password.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { errore: 'Email o password non corretti.' }

  const ruolo = await leggiRuolo(db, data.user.id)
  if (!ruolo) {
    await supabase.auth.signOut({ scope: 'local' })
    return { errore: 'Account senza permessi: chiedi all’amministratore di abilitarlo.' }
  }
  redirect(destinazioneDopoLogin(next, ruolo))
}

export async function esci(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/accesso')
}
