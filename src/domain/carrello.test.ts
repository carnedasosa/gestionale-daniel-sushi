import { expect, it } from 'vitest'
import { validaCarrello } from './carrello'
const id = '11111111-1111-4111-8111-111111111111'
const riga = { piattoId: id, quantita: 2, nota: ' senza sesamo ', prezzoCent: 1 }
it('normalizza nota e ignora prezzo client', () => {
  expect(validaCarrello([riga])).toEqual({ ok: true, righe: [{ piattoId: id, quantita: 2, nota: 'senza sesamo' }] })
  expect(validaCarrello([{ piattoId: null, quantita: 1, nota: '', poke: { Base: ['Riso'] } }]).ok).toBe(true)
})
it('rifiuta tutti gli input malformati e i limiti superati', () => {
  for (const input of [null, {}, 'x', [], Array(41).fill(riga), [null], [{ ...riga, quantita: 0 }], [{ ...riga, quantita: 21 }], [{ ...riga, quantita: 1.2 }], [{ ...riga, quantita: '2' }], [{ ...riga, nota: 4 }], [{ ...riga, nota: 'x'.repeat(201) }], [{ ...riga, piattoId: 'x' }], [{ ...riga, piattoId: null }], [{ ...riga, piattoId: null, poke: [] }], [{ ...riga, piattoId: null, poke: null }], [{ ...riga, poke: { Base: ['Riso'] } }]]) expect(validaCarrello(input).ok).toBe(false)
})
