import { expect, it } from 'vitest'
import { vistaStaff } from './vista'
it('vista dello staff: quattro schede, ordini se il valore non è valido', () => {
  expect(['ordini','tavoli','conti','menu','x',undefined,['tavoli']].map(v => vistaStaff(v))).toEqual(['ordini','tavoli','conti','menu','ordini','ordini','ordini'])
})
it('vista per postazione: banco e cucina solo ordini e menù, la sala senza menù', () => {
  const tutte = ['ordini','tavoli','conti','menu']
  expect(tutte.map(v => vistaStaff(v,'banco'))).toEqual(['ordini','ordini','ordini','menu'])
  expect(tutte.map(v => vistaStaff(v,'cucina'))).toEqual(['ordini','ordini','ordini','menu'])
  expect(tutte.map(v => vistaStaff(v,'sala'))).toEqual(['ordini','tavoli','conti','ordini'])
  expect(tutte.map(v => vistaStaff(v,'cassa'))).toEqual(tutte)
})
