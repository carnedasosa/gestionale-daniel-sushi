// Foto dei piatti: controlli sui byte ricevuti. Il tipo si riconosce dai primi byte, non dal nome del file.
export const MAX_BYTE_FOTO = 400 * 1024
export const LATO_FOTO = 800
export type TipoFoto = 'image/webp' | 'image/jpeg' | 'image/png'
export interface InfoFoto { versione: string; larghezza: number; altezza: number }

const inizia = (b: Uint8Array, firma: number[], da = 0) => firma.every((x,i) => b[da + i] === x)
export function tipoFoto(b: Uint8Array): TipoFoto | null {
  if (b.length >= 12 && inizia(b,[0x52,0x49,0x46,0x46]) && inizia(b,[0x57,0x45,0x42,0x50],8)) return 'image/webp'
  if (b.length >= 3 && inizia(b,[0xff,0xd8,0xff])) return 'image/jpeg'
  if (b.length >= 8 && inizia(b,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return 'image/png'
  return null
}
export const dimensioneValida = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 16 && n <= 2000
export const versioneValida = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{16}$/.test(v)

/** Lato lungo portato a `lato` px (mai ingrandito): dimensioni con cui il browser ridisegna la foto. */
export function dimensioniRidotte(larghezza: number, altezza: number, lato = LATO_FOTO): { larghezza: number; altezza: number } {
  const k = Math.min(1,lato / Math.max(larghezza,altezza))
  return { larghezza: Math.max(1,Math.round(larghezza * k)),altezza: Math.max(1,Math.round(altezza * k)) }
}
export const urlFoto = (piattoId: string, versione: string) => `/foto/${piattoId}/${versione}`
