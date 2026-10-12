import { expect, it } from 'vitest'
import { arriviCucina, leggiStatoArrivi, segnaLetto } from './arrivi-cucina'
it('non suona al primo avvio, segnala solo arrivi successivi e non ripete i già visti', () => {
  const primo = arriviCucina(null,['1'])
  expect(primo).toEqual({ stato: { visti: ['1'],nuovi: [] },arrivati: [] })
  const secondo = arriviCucina(primo.stato,['1','2'])
  expect(secondo).toEqual({ stato: { visti: ['1','2'],nuovi: ['2'] },arrivati: ['2'] })
  expect(arriviCucina(secondo.stato,['1','2']).arrivati).toEqual([])
})
it('tiene i nuovi non letti finché sono in cucina e dimentica gli ordini usciti', () => {
  const s = arriviCucina({ visti: ['1','2'],nuovi: ['2'] },['2','3']).stato
  expect(s).toEqual({ visti: ['2','3'],nuovi: ['2','3'] })
  expect(segnaLetto(s,'2')).toEqual({ visti: ['2','3'],nuovi: ['3'] })
  expect(arriviCucina(s,['3']).stato).toEqual({ visti: ['3'],nuovi: ['3'] })
})
it('un ordine arrivato mentre lo schermo era smontato viene segnalato al ritorno', () => {
  const salvato = JSON.stringify(arriviCucina(null,['1']).stato)
  expect(arriviCucina(leggiStatoArrivi(salvato),['1','2']).arrivati).toEqual(['2'])
})
it('ignora valori salvati illeggibili o malformati', () => {
  expect(leggiStatoArrivi(null)).toBeNull()
  expect(leggiStatoArrivi('{')).toBeNull()
  expect(leggiStatoArrivi('{"visti":[1],"nuovi":[]}')).toBeNull()
  expect(leggiStatoArrivi('{"visti":["a"]}')).toBeNull()
  expect(leggiStatoArrivi(JSON.stringify({ visti: Array(501).fill('a'),nuovi: [] }))).toBeNull()
  expect(leggiStatoArrivi('{"visti":["a"],"nuovi":["a"]}')).toEqual({ visti: ['a'],nuovi: ['a'] })
})
