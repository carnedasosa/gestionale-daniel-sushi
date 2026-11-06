'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { destinazioneDopoLogin } from '@/auth/regole'
import { leggiRuolo } from '@/auth/ruoli-repo'
import { annullaTentativoAccesso, prenotaTentativoAccesso } from '@/auth/tentativi-accesso-repo'
import { accessoBloccato, chiaveEmail, erroreDiCredenziali, FINESTRA_ACCESSO_MINUTI } from '@/domain/limiti-accesso'
import { ipDaHeaders } from '@/domain/ip-client'

export type StatoAccesso = { errore: string | null }

const NON_RIUSCITO = 'Accesso non riuscito: controlla la connessione e riprova.'

export async function entra(_stato: StatoAccesso, formData: FormData): Promise<StatoAccesso> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')
  if (!email || !password) return { errore: 'Inserisci email e password.' }

  // redirect() funziona lanciando un'eccezione: va fuori dal try.
  let destinazione: string
  try {
    const { id,errori } = await prenotaTentativoAccesso(db,{ chiave: chiaveEmail(email),rete: ipDaHeaders(await headers()),minuti: FINESTRA_ACCESSO_MINUTI })
    // Stesso messaggio per ogni indirizzo scritto, esistente o no. Chi insiste da bloccato non allunga il blocco.
    if (accessoBloccato(errori)) {
      await annullaTentativoAccesso(db,id)
      return { errore: 'Troppi tentativi di accesso: riprova tra qualche minuto.' }
    }
    const supabase = await createClient()
    const { data,error } = await supabase.auth.signInWithPassword({ email,password })
    if (error && erroreDiCredenziali(error)) return { errore: 'Email o password non corretti.' }
    await annullaTentativoAccesso(db,id)
    if (error || !data.user) return { errore: NON_RIUSCITO }

    const ruolo = await leggiRuolo(db,data.user.id)
    if (!ruolo) {
      await supabase.auth.signOut({ scope: 'local' })
      return { errore: 'Account senza permessi: chiedi all’amministratore di abilitarlo.' }
    }
    destinazione = destinazioneDopoLogin(next,ruolo)
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: NON_RIUSCITO }
  }
  redirect(destinazione)
}

export async function esci(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/accesso')
}
