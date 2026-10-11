import { describe, expect, it } from 'vitest'
import { euroInCentesimi, formatEuro, parseEuro } from './soldi'

describe('euroInCentesimi', () => {
  it('converte senza errori di virgola mobile', () => {
    expect(euroInCentesimi(10.5)).toBe(1050)
    expect(euroInCentesimi(2.3)).toBe(230)
    expect(euroInCentesimi(0)).toBe(0)
  })
  it('rifiuta negativi e valori non finiti', () => {
    expect(() => euroInCentesimi(-1)).toThrow(RangeError)
    expect(() => euroInCentesimi(Number.NaN)).toThrow(RangeError)
  })
})

describe('parseEuro', () => {
  it.each([
    ['10', 1000], ['10,5', 1050], ['10,50', 1050], ['10.50', 1050],
    ['€ 10,50', 1050], ['10,50 €', 1050], [' 3 ', 300], ['0', 0], ['0,05', 5],
  ])('accetta %j', (testo, atteso) => {
    expect(parseEuro(testo)).toBe(atteso)
  })
  it.each(['', '  ', 'abc', '-3', '1,234', '10,5,0', '1.000,00', '10 50', '1e3'])('rifiuta %j', (testo) => {
    expect(parseEuro(testo)).toBeNull()
  })
})

describe('formatEuro', () => {
  it('usa la virgola e lo spazio indivisibile prima di €', () => {
    expect(formatEuro(1050)).toBe('10,50 €')
    expect(formatEuro(0)).toBe('0,00 €')
    expect(formatEuro(5)).toBe('0,05 €')
  })
})
