import { expect, it } from 'vitest'
import { arriviCucina } from './arrivi-cucina'
it('non suona al primo montaggio, segnala solo arrivi successivi e non ripete i già visti', () => {
  const primo = arriviCucina(null,['1'])
  expect(primo.nuovi).toEqual([])
  const secondo = arriviCucina(primo.visti,['1','2'])
  expect(secondo.nuovi).toEqual(['2'])
  expect(arriviCucina(secondo.visti,['1']).nuovi).toEqual([])
})
