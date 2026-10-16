import { expect, it } from 'vitest'
import { ETICHETTA_REPARTO, raggruppaPerReparto, repartoSeed, repartoValido } from './reparti'
it('reparti ammessi ed etichette', () => {
  expect(repartoValido('banco')).toBe(true); expect(repartoValido('sala')).toBe(true)
  expect(repartoValido('bar')).toBe(false); expect(repartoValido(null)).toBe(false); expect(repartoValido(1)).toBe(false)
  expect(ETICHETTA_REPARTO).toEqual({ banco: 'Banco sushi',cucina: 'Cucina',sala: 'Sala' })
})
it('le categorie del seed: cucina e sala per nome, il resto al banco', () => {
  expect(['starter','primi','dessert'].map(repartoSeed)).toEqual(['cucina','cucina','cucina'])
  expect(repartoSeed('beverage')).toBe('sala')
  expect(['tartare','uramaki','poke-bowl','box','nuova'].map(repartoSeed)).toEqual(['banco','banco','banco','banco','banco'])
})
it('raggruppa nell’ordine banco, cucina, sala e salta i reparti vuoti', () => {
  const righe = [{ id: 1,reparto: 'sala' as const },{ id: 2,reparto: 'banco' as const },{ id: 3,reparto: 'sala' as const },{ id: 4,reparto: 'banco' as const }]
  expect(raggruppaPerReparto(righe)).toEqual([
    { reparto: 'banco',righe: [{ id: 2,reparto: 'banco' },{ id: 4,reparto: 'banco' }] },
    { reparto: 'sala',righe: [{ id: 1,reparto: 'sala' },{ id: 3,reparto: 'sala' }] },
  ])
  expect(raggruppaPerReparto([])).toEqual([])
})
