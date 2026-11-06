import { expect, it } from 'vitest'
import { accessoBloccato, chiaveEmail, erroreDiCredenziali, LIMITE_EMAIL, LIMITE_RETE_ACCESSO } from './limiti-accesso'

it('blocca a 10 errori per email o 30 per rete, non prima', () => {
  expect(LIMITE_EMAIL).toBe(10); expect(LIMITE_RETE_ACCESSO).toBe(30)
  expect(accessoBloccato({ email: 9,rete: 29 })).toBe(false)
  expect(accessoBloccato({ email: 10,rete: 0 })).toBe(true)
  expect(accessoBloccato({ email: 0,rete: 30 })).toBe(true)
})

it('la chiave non contiene l’email e non cambia con maiuscole e spazi', () => {
  const k = chiaveEmail('Daniel@Esempio.it')
  expect(k).toMatch(/^[0-9a-f]{64}$/)
  expect(chiaveEmail('  daniel@esempio.it ')).toBe(k)
  expect(chiaveEmail('altra@esempio.it')).not.toBe(k)
})

it('contano i rifiuti di Supabase, non i suoi guasti né il suo limite di richieste', () => {
  expect(erroreDiCredenziali({ status: 400 })).toBe(true)
  expect(erroreDiCredenziali({ status: 403 })).toBe(true)
  for (const e of [{ status: 429 },{ status: 500 },{ status: 503 },{ status: 0 },{},null,undefined]) expect(erroreDiCredenziali(e)).toBe(false)
})
