import { expect, it } from 'vitest'
import { leggiUltimoOrdine } from './archivio-casa'
const token = 'abcdefghijklmnopqrstuvwxyz012345', adesso = Date.parse('2026-10-12T18:00:00Z')
it('ultimo ordine valido solo per 12 ore e con un token plausibile', () => {
  const salvato = (diverso: object) => JSON.stringify({ token,numero: 7,salvatoIl: adesso - 3600000,...diverso })
  expect(leggiUltimoOrdine(salvato({}),adesso)).toEqual({ token,numero: 7,salvatoIl: adesso - 3600000 })
  expect(leggiUltimoOrdine(salvato({ salvatoIl: adesso - 13 * 3600000 }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ salvatoIl: adesso + 3600000 }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ token: '../admin' }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ numero: '7' }),adesso)).toBeNull()
  for (const t of [null,'','{',JSON.stringify(null),'[]']) expect(leggiUltimoOrdine(t,adesso)).toBeNull()
})
