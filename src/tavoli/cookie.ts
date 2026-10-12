import { chiaveValida } from './validazione'
export const COOKIE_DISPOSITIVO = 'ds_dispositivo'
export const OPZIONI_COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }
export function nomeCookieTavolo(chiave: string): string {
  if (!chiaveValida(chiave)) throw new Error('Tavolo non valido')
  return `ds_tavolo_${chiave}`
}
export function opzioniCookieTavolo(chiave: string) { return { ...OPZIONI_COOKIE, path: `/tavolo/${chiave}`, maxAge: 12 * 60 * 60 } }
