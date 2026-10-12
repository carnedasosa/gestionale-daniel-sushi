import { expect, it } from 'vitest'
import { autorizzatoCron } from './cron'
const segreto = 'abcdefghijklmnop1234'
it('solo con il segreto giusto, preceduto da Bearer, e lungo almeno 16 caratteri', () => {
  expect(autorizzatoCron(`Bearer ${segreto}`,segreto)).toBe(true)
  expect(autorizzatoCron(segreto,segreto)).toBe(false)
  expect(autorizzatoCron(`Bearer ${segreto}x`,segreto)).toBe(false)
  expect(autorizzatoCron(null,segreto)).toBe(false)
  expect(autorizzatoCron('Bearer ',undefined)).toBe(false)
  expect(autorizzatoCron('Bearer corto','corto')).toBe(false)
})
