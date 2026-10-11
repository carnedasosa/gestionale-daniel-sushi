import { expect, it } from 'vitest'
import { origineApp } from './origine-app'
it('usa APP_URL e preserva HTTP locale anche senza proxy', () => {
  expect(origineApp(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  expect(origineApp(new Headers({ host: '127.0.0.1:3000' }))).toBe('http://127.0.0.1:3000')
  expect(origineApp(new Headers({ host: 'ordini.example','x-forwarded-proto': 'https,http' }))).toBe('https://ordini.example')
  expect(origineApp(new Headers(),'https://ordini.example/path')).toBe('https://ordini.example')
  expect(() => origineApp(new Headers(),'javascript:alert(1)')).toThrow()
  expect(() => origineApp(new Headers(),'https://user:password@example.com')).toThrow()
})
