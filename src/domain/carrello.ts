import type { SceltePoke } from './poke'
import { idValido } from '@/tavoli/validazione'
export interface RigaCarrello { piattoId: string | null; quantita: number; nota: string; poke?: SceltePoke }
export function validaCarrello(input: unknown): { ok: true; righe: RigaCarrello[] } | { ok: false; errore: string } {
  const errore = { ok: false as const, errore: 'Carrello non valido: controlla quantità, note e piatti.' }
  if (!Array.isArray(input) || input.length < 1 || input.length > 40) return errore
  const righe: RigaCarrello[] = []
  for (const r of input) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || !Number.isInteger(r.quantita) || r.quantita < 1 || r.quantita > 20 || typeof r.nota !== 'string' || r.nota.length > 200) return errore
    if (r.piattoId !== null && !idValido(r.piattoId)) return errore
    if (r.piattoId === null && (!r.poke || typeof r.poke !== 'object' || Array.isArray(r.poke))) return errore
    if (r.piattoId !== null && r.poke !== undefined) return errore
    righe.push({ piattoId: r.piattoId, quantita: r.quantita, nota: r.nota.trim(), ...(r.piattoId === null ? { poke: r.poke } : {}) })
  }
  return { ok: true, righe }
}
