import { expect, it } from 'vitest'
import { bloccato } from './limiti-tentativi'
it('blocca al limite del dispositivo o del tavolo', () => {
  expect(bloccato(4, 29)).toBe(false)
  expect(bloccato(5, 0)).toBe(true)
  expect(bloccato(0, 30)).toBe(true)
})
