import { expect, it } from 'vitest'
import { valutaAccesso } from './accesso-tavolo'
it('pulisce cookie vecchi o estranei e annuncia solo la chiusura del proprio tavolo', () => {
  expect(valutaAccesso('a',true,{ tavoloId: 'a',chiusaIl: null })).toEqual({ autorizzata: true,pulisci: false,chiuso: false })
  expect(valutaAccesso('a',true,{ tavoloId: 'b',chiusaIl: new Date() })).toEqual({ autorizzata: false,pulisci: true,chiuso: false })
  expect(valutaAccesso('a',true,{ tavoloId: 'a',chiusaIl: new Date() })).toEqual({ autorizzata: false,pulisci: true,chiuso: true })
  expect(valutaAccesso('a',true,null)).toEqual({ autorizzata: false,pulisci: true,chiuso: false })
  expect(valutaAccesso('a',false,null)).toEqual({ autorizzata: false,pulisci: false,chiuso: false })
})
