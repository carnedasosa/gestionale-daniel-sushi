'use server'
import { cookies } from 'next/headers'
import { richiediRuolo } from '@/auth/sessione'
import { COOKIE_POSTAZIONE, OPZIONI_COOKIE_POSTAZIONE, postazioneValida } from '@/domain/postazioni'
import type { EsitoStaff } from './azioni'
/** Ricorda su questo dispositivo che cosa fa (cassa, banco, cucina, sala). */
export async function impostaPostazione(postazione: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!postazioneValida(postazione)) return { ok: false,errore: 'Postazione non valida.' }
  ;(await cookies()).set(COOKIE_POSTAZIONE,postazione,{ ...OPZIONI_COOKIE_POSTAZIONE,secure: process.env.NODE_ENV === 'production' })
  return { ok: true }
}
