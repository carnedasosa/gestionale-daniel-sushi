import { expect, it } from 'vitest'
import { slugDaNome, slugLibero } from './slug-tavolo'
it('normalizza nomi, accenti, simboli e lunghezza', () => {
  expect(slugDaNome(' Tavolo Caffè 1 ')).toBe('tavolo-caffe-1')
  expect(slugDaNome('###')).toBe('tavolo')
  expect(slugDaNome('A'.repeat(80))).toHaveLength(40)
  expect(slugLibero('Tavolo 1',['tavolo-1','tavolo-1-2'])).toBe('tavolo-1-3')
  expect(slugLibero('A'.repeat(80),['a'.repeat(40)])).toHaveLength(40)
})
