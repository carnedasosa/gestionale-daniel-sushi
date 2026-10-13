import { expect, it } from 'vitest'
import { aperturaServizio, modalitaProva, type DatiApertura } from './apertura-casa'
const aperto: DatiApertura = { allergeniCompleti: true,telefono: '0801234567',apertiIl: '2026-10-12',oggi: '2026-10-12',chiusoOggi: false,zoneAttive: 1,fasceLibere: 3,prova: false }
it('aperto quando tutte le condizioni valgono', () => {
  expect(aperturaServizio('asporto',aperto)).toEqual({ aperto: true })
  expect(aperturaServizio('domicilio',aperto)).toEqual({ aperto: true })
})
it('il motivo è la prima condizione che manca', () => {
  const tutto = { ...aperto,allergeniCompleti: false,telefono: null,apertiIl: '2026-10-11',chiusoOggi: true,zoneAttive: 0,fasceLibere: 0 }
  expect(aperturaServizio('domicilio',tutto)).toEqual({ aperto: false,motivo: 'allergeni' })
  expect(aperturaServizio('domicilio',{ ...tutto,allergeniCompleti: true })).toEqual({ aperto: false,motivo: 'telefono' })
  expect(aperturaServizio('domicilio',{ ...aperto,apertiIl: null })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(aperturaServizio('domicilio',{ ...aperto,apertiIl: '2026-10-11' })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(aperturaServizio('domicilio',{ ...aperto,chiusoOggi: true })).toEqual({ aperto: false,motivo: 'chiusura' })
  expect(aperturaServizio('domicilio',{ ...aperto,zoneAttive: 0 })).toEqual({ aperto: false,motivo: 'zone' })
  expect(aperturaServizio('asporto',{ ...aperto,zoneAttive: 0 })).toEqual({ aperto: true })
  expect(aperturaServizio('asporto',{ ...aperto,fasceLibere: 0 })).toEqual({ aperto: false,motivo: 'fasce' })
})
it('la prova salta solo gli allergeni, e mai in produzione', () => {
  expect(aperturaServizio('asporto',{ ...aperto,allergeniCompleti: false,prova: true })).toEqual({ aperto: true })
  expect(aperturaServizio('asporto',{ ...aperto,allergeniCompleti: false,prova: true,apertiIl: null })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(modalitaProva({ ORDINI_CASA_PROVA: '1',NODE_ENV: 'development' })).toBe(true)
  expect(modalitaProva({ ORDINI_CASA_PROVA: '1',NODE_ENV: 'production' })).toBe(false)
  expect(modalitaProva({ ORDINI_CASA_PROVA: 'true',NODE_ENV: 'development' })).toBe(false)
  expect(modalitaProva({ NODE_ENV: 'development' })).toBe(false)
})
import { requisitiCasa } from './apertura-casa'
it('requisitiCasa: quattro voci, solo telefono e allergeni bloccano tutto', () => {
  const r = requisitiCasa({ telefono: null,allergeniCompleti: false,pokeConfermati: false,zoneAttive: 0 })
  expect(r.map(v => [v.chiave,v.ok,v.blocca])).toEqual([['telefono',false,true],['allergeni',false,true],['poke',false,false],['zone',false,false]])
  expect(r.find(v => v.chiave === 'allergeni')!.link).toEqual({ href: '/admin/menu?filtro=allergeni',testo: 'Conferma nel menù' })
  const ok = requisitiCasa({ telefono: '080 123',allergeniCompleti: true,pokeConfermati: null,zoneAttive: 2 })
  expect(ok.map(v => v.chiave)).toEqual(['telefono','allergeni','zone']); expect(ok.every(v => v.ok && v.link === null)).toBe(true)
})
