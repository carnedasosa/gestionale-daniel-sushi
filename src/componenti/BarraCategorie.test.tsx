import { expect, it } from 'vitest'
import { codaPillole, sezioneAttiva } from './BarraCategorie'
it("categoria evidenziata: l'ultima il cui titolo è salito sotto la barra", () => {
  const sezioni = [{ id: 'a',top: -400 },{ id: 'b',top: 60 },{ id: 'c',top: 900 }]
  expect(sezioneAttiva(sezioni,80)).toBe('b')
  expect(sezioneAttiva(sezioni,40)).toBe('a')
  expect(sezioneAttiva([{ id: 'a',top: 300 }],80)).toBe('a')
  expect(sezioneAttiva([],80)).toBeNull()
})
it('sfumatura dal lato in cui la fila continua', () => {
  expect(codaPillole(0,300,300)).toBeUndefined()
  expect(codaPillole(0,300,900)).toBe('destra')
  expect(codaPillole(200,300,900)).toBe('entrambe')
  expect(codaPillole(600,300,900)).toBe('sinistra')
})
