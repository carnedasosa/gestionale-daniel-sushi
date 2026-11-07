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
const registraErrore = (err: unknown) => { console.error(err instanceof Error ? err.message : 'errore sconosciuto') }

export async function entra(_stato: StatoAccesso, formData: FormData): Promise<StatoAccesso> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')
  if (!email || !password) return { errore: 'Inserisci email e password.' }

  // redirect() funziona lanciando un'eccezione: va fuori dal try.
  let destinazione: string
  // Il tentativo da togliere alla fine: resta registrato solo se Supabase ha rifiutato le credenziali.
  let daAnnullare: string | null = null
  // Il client con la sessione appena aperta: da qui in poi il cookie è già scritto.
  let entrato: Awaited<ReturnType<typeof createClient>> | null = null
  try {
    const { id,errori } = await prenotaTentativoAccesso(db,{ chiave: chiaveEmail(email),rete: ipDaHeaders(await headers()),minuti: FINESTRA_ACCESSO_MINUTI })
    daAnnullare = id
    // Stesso messaggio per ogni indirizzo scritto, esistente o no. Chi insiste da bloccato non allunga il blocco.
    if (accessoBloccato(errori)) return { errore: 'Troppi tentativi di accesso: riprova tra qualche minuto.' }
    const supabase = await createClient()
    const { data,error } = await supabase.auth.signInWithPassword({ email,password })
    if (error && erroreDiCredenziali(error)) {
      daAnnullare = null
      return { errore: 'Email o password non corretti.' }
    }
    if (error || !data.user) return { errore: NON_RIUSCITO }
    entrato = supabase

    const ruolo = await leggiRuolo(db,data.user.id)
    if (!ruolo) {
      await supabase.auth.signOut({ scope: 'local' })
      return { errore: 'Account senza permessi: chiedi all’amministratore di abilitarlo.' }
    }
    destinazione = destinazioneDopoLogin(next,ruolo)
  } catch (err) {
    registraErrore(err)
    // Non si può dire «non riuscito» a chi ha già il cookie: ricaricando la pagina sarebbe dentro.
    if (entrato) await entrato.auth.signOut({ scope: 'local' }).catch(registraErrore)
    return { errore: NON_RIUSCITO }
  } finally {
    // Se non riesce resta un errore in più nel conteggio: non deve cambiare l'esito del login.
    if (daAnnullare) await annullaTentativoAccesso(db,daAnnullare).catch(registraErrore)
  }
  redirect(destinazione)
}

// Globale: un cookie rubato non sopravvive a «Esci». Escono tutti i dispositivi dello stesso utente.
// Se Supabase non risponde la libreria toglie comunque la sessione da questo dispositivo, ma le altre restano aperte:
// chi esce deve saperlo, e per riprovare deve rientrare, perché qui il token non c'è più.
export async function esci(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) {
    console.error(error.message)
    redirect('/accesso?errore=uscita')
  }
  redirect('/accesso')
}
