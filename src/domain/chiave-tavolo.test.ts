import { expect, it } from 'vitest'
import { generaChiaveTavolo } from './chiave-tavolo'
it('genera dodici caratteri uniformi da byte crittografici, scartando 252–255', () => {
  expect(generaChiaveTavolo(() => Uint8Array.from([255,252,0,1,2,3,4,5,6,7,8,9,10,35]))).toBe('abcdefghijk9')
  expect(generaChiaveTavolo()).toMatch(/^[a-z0-9]{12}$/)
})
