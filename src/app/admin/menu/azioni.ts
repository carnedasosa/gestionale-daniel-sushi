'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { aggiornaPiatto, aggiornaRepartoCategoria, creaPiatto } from '@/menu/repo'
import { repartoValido } from '@/domain/reparti'
import { cambiaDisponibilitaPiatto, type EsitoDisponibilita } from '@/menu/cambia-disponibilita'
import { inputDaForm, validaPiatto, type InputPiatto } from '@/menu/valida-piatto'

export type StatoModulo = {
  salvato: boolean
  errori: Partial<Record<keyof InputPiatto, string>>
  erroreGenerale: string | null
  // Valori inviati, restituiti in caso di errore: React azzera i campi dopo ogni azione e il modulo li ripristina da qui.
  valori: InputPiatto | null
  // Cresce a ogni invio: serve come key del modulo per riapplicare i valori iniziali dopo l'azzeramento.
  invii: number
}

export async function salvaPiatto(id: string, stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  const input = inputDaForm(fd)
  const invii = stato.invii + 1
  const esito = validaPiatto(input)
  if (!esito.ok) return { salvato: false, errori: esito.errori, erroreGenerale: null, valori: input, invii }
  let piatto: Awaited<ReturnType<typeof aggiornaPiatto>>
  try {
    piatto = await aggiornaPiatto(db, id, esito.dati)
  } catch (err) {
    // Solo il messaggio, mai variabili d'ambiente: la stringa di connessione contiene la password.
    console.error('salvaPiatto non riuscito:', err instanceof Error ? err.message : 'errore sconosciuto')
    return { salvato: false, errori: {}, erroreGenerale: 'Salvataggio non riuscito: controlla la connessione e riprova.', valori: input, invii }
  }
  if (!piatto) return { salvato: false, errori: {}, erroreGenerale: 'Piatto non trovato: forse è stato eliminato.', valori: input, invii }
  revalidatePath('/admin/menu')
  revalidatePath(`/admin/menu/${piatto.id}`)
  revalidatePath('/')
  return { salvato: true, errori: {}, erroreGenerale: null, valori: null, invii }
}

export async function cambiaDisponibilita(id: string, disponibile: boolean): Promise<EsitoDisponibilita> {
  await richiediRuolo('admin')
  return cambiaDisponibilitaPiatto(id, disponibile)
}

export type EsitoReparto = { ok: true } | { ok: false; errore: string }

/** Reparto che prepara una categoria: vale per gli ordini da adesso, le righe già inviate restano dove sono. */
export async function cambiaRepartoCategoria(id: string, reparto: string): Promise<EsitoReparto> {
  await richiediRuolo('admin')
  if (typeof id !== 'string' || !repartoValido(reparto)) return { ok: false, errore: 'Reparto non valido.' }
  let trovata: boolean
  try {
    trovata = await aggiornaRepartoCategoria(db, id, reparto)
  } catch (err) {
    // Solo il messaggio, mai variabili d'ambiente: la stringa di connessione contiene la password.
    console.error('cambiaRepartoCategoria non riuscito:', err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false, errore: 'Salvataggio non riuscito: controlla la connessione e riprova.' }
  }
  revalidatePath('/admin/menu')
  revalidatePath('/staff')
  revalidatePath('/')
  return trovata ? { ok: true } : { ok: false, errore: 'Categoria non trovata.' }
}

/** Piatto nuovo (anche una voce della carta dei vini): categoria e numero dal modulo, poi si apre la sua scheda. */
export async function creaNuovoPiatto(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  const input = inputDaForm(fd)
  const invii = stato.invii + 1
  const categoriaId = String(fd.get('categoriaId') ?? ''), numeroTesto = String(fd.get('numero') ?? '').trim()
  const numero = numeroTesto ? Number(numeroTesto) : null
  if (!/^[a-z0-9-]{1,60}$/.test(categoriaId)) return { salvato: false, errori: {}, erroreGenerale: 'Scegli la categoria.', valori: input, invii }
  if (numero !== null && (!/^\d{1,4}$/.test(numeroTesto) || numero < 1)) return { salvato: false, errori: {}, erroreGenerale: 'Il numero va da 1 a 9999, oppure lascialo vuoto.', valori: input, invii }
  const esito = validaPiatto(input)
  if (!esito.ok) return { salvato: false, errori: esito.errori, erroreGenerale: null, valori: input, invii }
  let creato: Awaited<ReturnType<typeof creaPiatto>>
  try {
    creato = await creaPiatto(db, categoriaId, numero, esito.dati)
  } catch (err) {
    console.error('creaNuovoPiatto non riuscito:', err instanceof Error ? err.message : 'errore sconosciuto')
    return { salvato: false, errori: {}, erroreGenerale: 'Salvataggio non riuscito: controlla la connessione e riprova.', valori: input, invii }
  }
  if (!creato.ok) return { salvato: false, errori: {}, erroreGenerale: creato.errore === 'numero' ? `Il numero ${numero} è già di un altro piatto.` : 'Categoria non trovata.', valori: input, invii }
  revalidatePath('/admin/menu')
  revalidatePath('/')
  redirect(`/admin/menu/${creato.id}`)
}
