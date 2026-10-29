import { expect, it } from 'vitest'
import { validaImpostazioniCassa } from './valida-cassa'

it('legge il prezzo del coperto in euro, vuoto vale zero', () => {
  expect(validaImpostazioniCassa({ coperto: '2,50' })).toEqual({ ok: true,dati: { copertoCent: 250 } })
  expect(validaImpostazioniCassa({ coperto: '' })).toEqual({ ok: true,dati: { copertoCent: 0 } })
  expect(validaImpostazioniCassa({ coperto: '20' })).toMatchObject({ ok: true })
  for (const coperto of ['20,01','-1','due','1.000,00']) expect(validaImpostazioniCassa({ coperto })).toMatchObject({ ok: false })
})
