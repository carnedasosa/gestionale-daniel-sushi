import type { RigaCarrello } from '@/domain/carrello'
import type { PokeConfig } from '@/menu/importa'
import type { Piatto } from '@/menu/repo'
import { pokeDaRicomporre } from '@/domain/carrello-salvato'
import { validaPoke } from '@/domain/poke'
export interface RigaVista extends RigaCarrello { nome: string; prezzoCent: number; daRicomporre?: boolean }
/** Nomi e prezzi stimati delle righe del carrello; il server ricalcola comunque tutto all'invio. */
export function vistaCarrello(righe: RigaCarrello[], piatti: Piatto[], config: PokeConfig | null): RigaVista[] {
  const invalidi = pokeDaRicomporre(righe,config)
  return righe.map((r,i) => {
    const p = piatti.find(p => p.id === r.piattoId)
    const poke = config && r.poke ? validaPoke(config,r.poke) : null
    return { ...r,daRicomporre: invalidi.includes(i),nome: r.piattoId === null ? 'Poke composta' : p?.nome ?? 'Piatto non più in menù',prezzoCent: p?.prezzoCent ?? (poke?.ok ? poke.prezzoCent : 0) }
  })
}
/** Somma stimata delle righe valide. */
export function totaleVista(righe: RigaVista[]): number {
  return righe.reduce((s,r) => s + (r.daRicomporre ? 0 : r.prezzoCent * r.quantita),0)
}
