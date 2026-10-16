import { expect, it } from 'vitest'
import { etichettaOrigine, origineValida } from './origine-ordine'
it('origini ammesse ed etichette solo per cassa e cameriere', () => {
  expect(origineValida('cassa')).toBe(true); expect(origineValida('telefono')).toBe(false); expect(origineValida(null)).toBe(false)
  expect(etichettaOrigine('cliente')).toBeNull(); expect(etichettaOrigine('cassa')).toBe('Dalla cassa'); expect(etichettaOrigine('cameriere')).toBe('Dal cameriere')
})
