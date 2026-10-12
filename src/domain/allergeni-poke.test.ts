import { expect, it } from 'vitest'
import { allergeniScelte, normalizzaAllergeniVoci } from './allergeni-poke'
const gruppi = [{ nome: 'Base',voci: ['Riso','Insalata'],min: 1,max: 1,inclusi: 1 },{ nome: 'Proteine',voci: ['Salmone','Tofu'],min: 1,max: 2,inclusi: 1 }]
it('normalizza: solo gruppi e voci esistenti, codici noti, ordine ufficiale', () => {
  const dato = { Base: { Riso: [],Pasta: ['glutine'] },Proteine: { Salmone: ['pesce'],Tofu: ['sesamo','soia','avocado'] },Altro: { X: ['latte'] } }
  expect(normalizzaAllergeniVoci(gruppi,dato)).toEqual({ Base: { Riso: [],Insalata: [] },Proteine: { Salmone: ['pesce'],Tofu: ['soia','sesamo'] } })
  expect(normalizzaAllergeniVoci(gruppi,'{}')).toEqual({ Base: { Riso: [],Insalata: [] },Proteine: { Salmone: [],Tofu: [] } })
  expect(normalizzaAllergeniVoci(gruppi,{ Base: { Riso: 'glutine' } }).Base.Riso).toEqual([])
})
it('allergeni delle scelte uniti senza ripetizioni', () => {
  const voci = normalizzaAllergeniVoci(gruppi,{ Base: { Riso: ['sesamo'] },Proteine: { Salmone: ['pesce','sesamo'],Tofu: ['soia'] } })
  expect(allergeniScelte(voci,{ Base: ['Riso'],Proteine: ['Salmone','Tofu'] })).toEqual(['pesce','soia','sesamo'])
  expect(allergeniScelte(voci,{ Base: ['Insalata'],Fantasma: ['X'] })).toEqual([])
})
