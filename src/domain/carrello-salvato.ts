import { validaCarrello, type RigaCarrello } from './carrello'
import { validaPoke } from './poke'
import type { PokeConfig } from '@/menu/importa'
import { idValido } from '@/tavoli/validazione'
export interface CarrelloSalvato { righe: RigaCarrello[]; chiaveInvio: string | null }
export function ripristinaCarrello(raw: string, genera: () => string): CarrelloSalvato {
  try {
    const dato: unknown = JSON.parse(raw)
    const c = dato && typeof dato === 'object' && !Array.isArray(dato) ? dato as Record<string,unknown> : null
    const esito = validaCarrello(c ? c.righe : dato)
    if (esito.ok) return { righe: esito.righe,chiaveInvio: idValido(c?.chiaveInvio) ? c.chiaveInvio : genera() }
  } catch { /* Dati di storage malformati: ripartiamo senza righe. */ }
  return { righe: [],chiaveInvio: null }
}
export function aggiornaCarrello(c: CarrelloSalvato, righe: RigaCarrello[],genera: () => string): CarrelloSalvato {
  if (JSON.stringify(c.righe) === JSON.stringify(righe)) return c
  return { righe,chiaveInvio: righe.length ? genera() : null }
}
export function pokeDaRicomporre(righe: RigaCarrello[], config: PokeConfig | null): number[] {
  return righe.flatMap((r,i) => r.piattoId === null && (!config || !validaPoke(config,r.poke).ok) ? [i] : [])
}
