import { expect, it } from 'vitest'
import { generaCodice, normalizzaCodice } from './codice-tavolo'

it('genera quattro cifre indipendenti e conserva gli zeri', () => {
  const cifre = [0, 0, 4, 2]
  expect(generaCodice((max) => { expect(max).toBe(10); return cifre.shift()! })).toBe('0042')
  for (let i = 0; i < 1000; i++) expect(generaCodice()).toMatch(/^\d{4}$/)
})
it('normalizza spazi e rifiuta codici malformati', () => {
  expect(normalizzaCodice(' 12 34 ')).toBe('1234')
  for (const s of ['123', '12345', 'abcd', '']) expect(normalizzaCodice(s)).toBeNull()
})
