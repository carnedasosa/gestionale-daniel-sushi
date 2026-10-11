import { describe, expect, it } from 'vitest'
import { ALLERGENI, eAllergene, etichettaAllergene, normalizzaAllergeni } from './allergeni'

describe('allergeni', () => {
  it('sono i 14 del Reg. UE 1169/2011', () => {
    expect(ALLERGENI).toHaveLength(14)
    expect(ALLERGENI.map((a) => a.codice)).toEqual([
      'glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia', 'latte',
      'frutta_a_guscio', 'sedano', 'senape', 'sesamo', 'solfiti', 'lupini', 'molluschi',
    ])
  })
  it('riconosce i codici', () => {
    expect(eAllergene('pesce')).toBe(true)
    expect(eAllergene('Pesce')).toBe(false)
    expect(eAllergene('avocado')).toBe(false)
  })
  it('dà l’etichetta italiana', () => {
    expect(etichettaAllergene('sesamo')).toBe('Semi di sesamo')
    expect(etichettaAllergene('solfiti')).toBe('Anidride solforosa e solfiti')
  })
  it('normalizza: niente doppioni, ordine di legge', () => {
    expect(normalizzaAllergeni(['sesamo', 'pesce', 'sesamo', 'glutine'])).toEqual(['glutine', 'pesce', 'sesamo'])
    expect(normalizzaAllergeni([])).toEqual([])
  })
  it('rifiuta codici sconosciuti', () => {
    expect(() => normalizzaAllergeni(['pesce', 'avocado'])).toThrow('Allergene sconosciuto: avocado')
  })
})
