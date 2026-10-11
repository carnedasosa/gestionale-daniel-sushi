import { expect, it } from 'vitest'
import { ipDaHeaders } from './ip-client'
it('usa il primo IP inoltrato, ripiega su real-ip e gestisce valori mancanti', () => {
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' 192.0.2.1, 10.0.0.1','x-real-ip': '192.0.2.2' }))).toBe('192.0.2.1')
  expect(ipDaHeaders(new Headers({ 'x-real-ip': ' 2001:db8::1 ' }))).toBe('2001:db8::1')
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' ,' }))).toBe('sconosciuto')
})
