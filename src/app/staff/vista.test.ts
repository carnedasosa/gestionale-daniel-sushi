import { expect, it } from 'vitest'
import { vistaStaff } from './vista'
it('vista dello staff: tre schede, ordini se il valore non è valido', () => {
  expect(['ordini','tavoli','conti','x',undefined,['tavoli']].map(vistaStaff)).toEqual(['ordini','tavoli','conti','ordini','ordini','ordini'])
})
