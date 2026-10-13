import { expect, it } from 'vitest'
import { STATI_TAVOLO, prossimoStato, puoAnnullare, etichettaStato } from './stati-tavolo'
it('gestisce tutte le transizioni e le etichette', () => {
  expect(STATI_TAVOLO.map(prossimoStato)).toEqual(['in_preparazione', 'servito', null, null])
  expect(STATI_TAVOLO.map(puoAnnullare)).toEqual([true, true, false, false])
  expect(STATI_TAVOLO.map(etichettaStato)).toEqual(['Inviato', 'In preparazione', 'Servito', 'Annullato'])
})
import { riassuntoTavolo } from './stati-tavolo'
it('riassuntoTavolo conta solo gli ordini in cucina della sessione', () => {
  const o = [{ sessioneId: 'a',stato: 'inviato' },{ sessioneId: 'a',stato: 'in_preparazione' },{ sessioneId: 'a',stato: 'servito' },{ sessioneId: 'b',stato: 'inviato' }]
  expect(riassuntoTavolo(o,'a')).toEqual({ inCucina: 2 }); expect(riassuntoTavolo(o,'c')).toEqual({ inCucina: 0 })
})
