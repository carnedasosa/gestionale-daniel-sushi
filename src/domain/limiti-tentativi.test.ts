import { expect, it } from 'vitest'
import { bloccato } from './limiti-tentativi'
it('blocca il telefono a cinque errori', () => {
  expect(bloccato({ dispositivo: 4,ip: 4,sessione: 4 })).toBe(false)
  expect(bloccato({ dispositivo: 5,ip: 5,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 5,ip: 0,sessione: 5 })).toBe(true)
})
it('la rete si blocca solo a venti errori, non a cinque', () => {
  expect(bloccato({ dispositivo: 0,ip: 5,sessione: 5 })).toBe(false)
  expect(bloccato({ dispositivo: 0,ip: 19,sessione: 19 })).toBe(false)
  expect(bloccato({ dispositivo: 0,ip: 20,sessione: 20 })).toBe(true)
})
it('a trenta errori per sessione blocca tutti i nuovi accessi', () => {
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 29 })).toBe(false)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 30 })).toBe(true)
})
it('sala sullo stesso Wi-Fi: chi non ha sbagliato entra anche dopo gli errori dei vicini', () => {
  expect(bloccato({ dispositivo: 0,ip: 12,sessione: 12 })).toBe(false)
})
