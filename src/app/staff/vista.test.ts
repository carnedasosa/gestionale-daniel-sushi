import { expect, it } from 'vitest'
import { vistaStaff } from './vista'
it('vista dello staff: quattro schede, ordini se il valore non è valido', () => {
  expect(['ordini','tavoli','conti','menu','x',undefined,['tavoli']].map(vistaStaff)).toEqual(['ordini','tavoli','conti','menu','ordini','ordini','ordini'])
})
