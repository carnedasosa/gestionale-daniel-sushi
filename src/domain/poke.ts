import type { PokeConfig } from '@/menu/importa'

export type SceltePoke = Record<string, string[]>
export type EsitoPoke = { ok: true; scelte: SceltePoke; prezzoCent: number } | { ok: false; errore: string }
export function pokeOrdinabile(c: PokeConfig): boolean {
  return c.prezzoBaseCent !== null && c.prezzoExtraCent !== null
}
export function validaPoke(c: PokeConfig, input: unknown): EsitoPoke {
  if (!pokeOrdinabile(c)) return { ok: false, errore: 'La poke composta non è ancora disponibile' }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errore: 'Scelte della poke non valide' }
  const dati = input as Record<string, unknown>
  if (Object.keys(dati).some(nome => !c.gruppi.some(g => g.nome === nome))) return { ok: false, errore: 'Gruppo della poke non valido' }
  const scelte: SceltePoke = {}
  let extra = 0
  for (const g of c.gruppi) {
    const voci = Object.hasOwn(dati,g.nome) ? dati[g.nome] : []
    if (!Array.isArray(voci) || voci.some(v => typeof v !== 'string' || !g.voci.includes(v)) || new Set(voci).size !== voci.length) return { ok: false, errore: `Scelta non valida in ${g.nome}` }
    if (voci.length < g.min) return { ok: false, errore: `Scegli almeno ${g.min} in ${g.nome}` }
    if (voci.length > g.max) return { ok: false, errore: `Al massimo ${g.max} in ${g.nome}` }
    Object.defineProperty(scelte,g.nome,{ value: g.voci.filter(v => voci.includes(v)), enumerable: true })
    extra += Math.max(0,voci.length - g.inclusi)
  }
  const prezzoCent = c.prezzoBaseCent! + extra * c.prezzoExtraCent!
  if (!Number.isSafeInteger(prezzoCent) || prezzoCent < 0 || prezzoCent > 2147483647) return { ok: false, errore: 'Prezzo della poke non valido' }
  return { ok: true, scelte, prezzoCent }
}
