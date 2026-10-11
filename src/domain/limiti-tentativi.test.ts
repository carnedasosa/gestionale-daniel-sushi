import { expect, it } from 'vitest'
import { bloccato } from './limiti-tentativi'
it('blocca dispositivo o IP a cinque errori e limita solo chi ha sbagliato', () => {
  expect(bloccato({ dispositivo: 4,ip: 4,sessione: 29 })).toBe(false)
  expect(bloccato({ dispositivo: 5,ip: 0,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 5,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 300 })).toBe(false)
  expect(bloccato({ dispositivo: 1,ip: 0,sessione: 30 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 1,sessione: 30 })).toBe(true)
})
