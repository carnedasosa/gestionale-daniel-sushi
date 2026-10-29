import { expect, it } from 'vitest'
import { copertiValidi, importoCoperti } from './coperti'

it('accetta da 1 a 99 coperti interi', () => {
  for (const v of [1,4,99]) expect(copertiValidi(v)).toBe(true)
  for (const v of [0,100,2.5,-1,'4',null,Number.NaN]) expect(copertiValidi(v)).toBe(false)
})
it('calcola l’importo solo con coperti e prezzo', () => {
  expect(importoCoperti(4,250)).toBe(1000)
  expect(importoCoperti(null,250)).toBe(0)
  expect(importoCoperti(4,0)).toBe(0)
  expect(importoCoperti(4,null)).toBe(0)
})
