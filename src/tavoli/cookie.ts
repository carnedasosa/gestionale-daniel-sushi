import { slugValido } from './validazione'
export const COOKIE_DISPOSITIVO = 'ds_dispositivo'
export const OPZIONI_COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }
export function nomeCookieTavolo(slug: string): string {
  if (!slugValido(slug)) throw new Error('Tavolo non valido')
  return `ds_tavolo_${slug}`
}
export function opzioniCookieTavolo(slug: string) { return { ...OPZIONI_COOKIE, path: `/tavolo/${slug}`, maxAge: 12 * 60 * 60 } }
