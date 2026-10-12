import { expect, it } from 'vitest'
import { ipDaHeaders, reteDaIp } from './ip-client'
it('usa il primo IP inoltrato, ripiega su real-ip e restituisce null se manca', () => {
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' 192.0.2.1, 10.0.0.1','x-real-ip': '192.0.2.2' }))).toBe('192.0.2.1')
  expect(ipDaHeaders(new Headers({ 'x-real-ip': ' 2001:db8::1 ' }))).toBe('2001:db8:0:0::/64')
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' ,' }))).toBeNull()
  expect(ipDaHeaders(new Headers())).toBeNull()
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': 'non-un-ip' }))).toBeNull()
})
it('raggruppa IPv6 per rete /64 e riconosce IPv4 incapsulato', () => {
  expect(reteDaIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64')
  expect(reteDaIp('2001:DB8:1:2::99')).toBe('2001:db8:1:2::/64')
  expect(reteDaIp('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
  expect(reteDaIp('::1')).toBe('0:0:0:0::/64')
  expect(reteDaIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
  expect(reteDaIp('::ffff:192.0.2.7')).toBe('192.0.2.7')
  expect(reteDaIp('2001:db8::192.0.2.7')).toBe('2001:db8:0:0::/64')
  expect(reteDaIp('192.0.2.300')).toBeNull()
})
