'use server'

import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { aggiornaPiatto, impostaDisponibile } from '@/menu/repo'
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

export async function cambiaDisponibilita(id: string, disponibile: boolean): Promise<void> {
  await richiediRuolo('admin')
  if (typeof disponibile !== 'boolean') return
  try {
    // Se il piatto non esiste più (false) si rivalida comunque: la pagina mostra lo stato reale.
    await impostaDisponibile(db, id, disponibile)
  } catch (err) {
    console.error('cambiaDisponibilita non riuscito:', err instanceof Error ? err.message : 'errore sconosciuto')
    return
  }
  revalidatePath('/admin/menu')
  revalidatePath('/')
}
