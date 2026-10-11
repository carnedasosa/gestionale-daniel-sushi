import { expect, it } from 'vitest'
import { validaPoke, pokeOrdinabile } from './poke'
import type { PokeConfig } from '@/menu/importa'
export const config: PokeConfig = { titolo: 'Poke', prezzoBaseCent: 900, prezzoExtraCent: 100, gruppi: [
  { nome: 'Base', voci: ['Riso'], min: 1, max: 1, inclusi: 1 },
  { nome: 'Proteine', voci: ['Salmone', 'Tonno', 'Tofu'], min: 1, max: 3, inclusi: 2 },
  { nome: 'Salse', voci: ['Soia', 'Teriyaki', 'Mayo'], min: 0, max: 3, inclusi: 2 },
] }
it('calcola base ed extra e normalizza secondo la configurazione', () => {
  expect(validaPoke(config, { Base: ['Riso'], Proteine: ['Salmone'] })).toMatchObject({ ok: true, prezzoCent: 900 })
  expect(validaPoke(config, { Base: ['Riso'], Proteine: ['Tofu','Salmone','Tonno'] })).toEqual({ ok: true, prezzoCent: 1000, scelte: { Base: ['Riso'], Proteine: ['Salmone','Tonno','Tofu'], Salse: [] } })
})
it('rifiuta minimi, massimi, scelte inventate, doppioni e gruppi sconosciuti', () => {
  expect(validaPoke(config, {})).toEqual({ ok: false, errore: 'Scegli almeno 1 in Base' })
  for (const scelte of [null, [], 'x', 4, { Base: ['Riso'], Proteine: ['Inventato'] }, { Base: ['Riso'], Proteine: ['Tonno','Tonno'] }, { Base: ['Riso'], Proteine: ['Tonno'], Altro: [] }]) expect(validaPoke(config, scelte).ok).toBe(false)
  expect(validaPoke({ ...config, gruppi: [{ ...config.gruppi[1], max: 1 }] }, { Proteine: ['Tonno','Tofu'] })).toEqual({ ok: false, errore: 'Al massimo 1 in Proteine' })
  expect(pokeOrdinabile({ ...config, prezzoBaseCent: null })).toBe(false)
})
