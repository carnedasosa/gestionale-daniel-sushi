import { ALLERGENI, eAllergene, type CodiceAllergene } from './allergeni'
import type { GruppoPoke } from '@/menu/importa'
import type { SceltePoke } from './poke'
/** Allergeni di ogni ingrediente: `{ gruppo: { voce: codici } }`. */
export type AllergeniVoci = Record<string,Record<string,CodiceAllergene[]>>
export interface AllergeniPoke { voci: AllergeniVoci; confermati: boolean }
/** Tiene solo gruppi e voci esistenti e codici noti, nell'ordine ufficiale dei 14 allergeni. */
export function normalizzaAllergeniVoci(gruppi: GruppoPoke[], dato: unknown): AllergeniVoci {
  const sorgente = dato && typeof dato === 'object' && !Array.isArray(dato) ? dato as Record<string,unknown> : {}
  const voci: AllergeniVoci = {}
  for (const g of gruppi) {
    const grezzo = Object.hasOwn(sorgente,g.nome) ? sorgente[g.nome] : null
    const gruppo = grezzo && typeof grezzo === 'object' && !Array.isArray(grezzo) ? grezzo as Record<string,unknown> : {}
    voci[g.nome] = {}
    for (const v of g.voci) {
      const codici = Object.hasOwn(gruppo,v) && Array.isArray(gruppo[v]) ? (gruppo[v] as unknown[]).filter((c): c is string => typeof c === 'string' && eAllergene(c)) : []
      voci[g.nome][v] = ALLERGENI.map(a => a.codice).filter(c => codici.includes(c))
    }
  }
  return voci
}
/** Allergeni della poke composta con queste scelte, senza ripetizioni. */
export function allergeniScelte(voci: AllergeniVoci, scelte: SceltePoke): CodiceAllergene[] {
  const tutti = new Set<CodiceAllergene>()
  for (const [gruppo,lista] of Object.entries(scelte)) for (const v of lista) for (const c of voci[gruppo]?.[v] ?? []) tutti.add(c)
  return ALLERGENI.map(a => a.codice).filter(c => tutti.has(c))
}
