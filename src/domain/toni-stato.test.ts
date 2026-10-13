import { expect, it } from 'vitest'
import { tonoStato } from './toni-stato'
it('ogni stato ha il suo tono', () => {
  expect((['in_attesa','inviato','accettato','in_preparazione','pronto','in_consegna','servito','completato','rifiutato','annullato'] as const).map(tonoStato))
    .toEqual(['accettare','preparare','preparare','preparazione','pronto','pronto','pronto','pronto','ritardo','ritardo'])
})
