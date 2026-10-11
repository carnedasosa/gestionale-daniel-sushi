'use server'

import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { aggiornaPiatto, impostaDisponibile } from '@/menu/repo'
import { inputDaForm, validaPiatto, type InputPiatto } from '@/menu/valida-piatto'

export type StatoModulo = { salvato: boolean; errori: Partial<Record<keyof InputPiatto, string>>; erroreGenerale: string | null }

export async function salvaPiatto(id: string, _stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  const esito = validaPiatto(inputDaForm(fd))
  if (!esito.ok) return { salvato: false, errori: esito.errori, erroreGenerale: null }
  const piatto = await aggiornaPiatto(db, id, esito.dati)
  if (!piatto) return { salvato: false, errori: {}, erroreGenerale: 'Piatto non trovato: forse è stato eliminato.' }
  revalidatePath('/admin/menu')
  revalidatePath('/')
  return { salvato: true, errori: {}, erroreGenerale: null }
}

export async function cambiaDisponibilita(id: string, disponibile: boolean): Promise<void> {
  await richiediRuolo('admin')
  await impostaDisponibile(db, id, disponibile)
  revalidatePath('/admin/menu')
  revalidatePath('/')
}
