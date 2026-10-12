import { expect, it } from 'vitest'
import { bloccato } from './limiti-tentativi'
it('blocca dispositivo o rete a cinque errori e tutti i nuovi accessi a trenta per sessione', () => {
  expect(bloccato({ dispositivo: 4,ip: 4,sessione: 29 })).toBe(false)
  expect(bloccato({ dispositivo: 5,ip: 0,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 5,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 30 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 29 })).toBe(false)
})
