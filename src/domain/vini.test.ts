import { expect, it } from 'vitest'
import { raggruppaVini, testoVino, validaVino, type DatiVino } from './vini'

const input = { vinoTipologia: 'bianco',vinoFormato: 'bottiglia',vinoCantina: ' Feudi di San Gregorio ',vinoDenominazione: 'Falanghina del Sannio DOC',vinoAnnata: '2024' }
it('valida i campi del vino: tipologia e formato obbligatori, il resto facoltativo', () => {
  expect(validaVino(input,2026)).toEqual({ ok: true,vino: { tipologia: 'bianco',formato: 'bottiglia',cantina: 'Feudi di San Gregorio',denominazione: 'Falanghina del Sannio DOC',annata: 2024 } })
  expect(validaVino({ ...input,vinoCantina: '',vinoDenominazione: '',vinoAnnata: '' },2026)).toEqual({ ok: true,vino: { tipologia: 'bianco',formato: 'bottiglia',cantina: null,denominazione: null,annata: null } })
  expect(validaVino({ ...input,vinoTipologia: 'arancione' },2026)).toMatchObject({ ok: false,errori: { vinoTipologia: expect.any(String) } })
  expect(validaVino({ ...input,vinoFormato: 'magnum' },2026)).toMatchObject({ ok: false,errori: { vinoFormato: expect.any(String) } })
  for (const vinoAnnata of ['2027','1899','24','duemila']) expect(validaVino({ ...input,vinoAnnata },2026)).toMatchObject({ ok: false,errori: { vinoAnnata: expect.any(String) } })
  expect(validaVino({ ...input,vinoCantina: 'x'.repeat(81) },2026)).toMatchObject({ ok: false })
})
it('testo del vino con le sole parti presenti', () => {
  const v: DatiVino = { tipologia: 'rosso',formato: 'calice',cantina: 'Tormaresca',denominazione: 'Castel del Monte DOC',annata: 2022 }
  expect(testoVino(v)).toBe('Tormaresca · Castel del Monte DOC · 2022')
  expect(testoVino({ ...v,cantina: null,annata: null })).toBe('Castel del Monte DOC')
})
it('raggruppa per tipologia nell’ordine della carta, senza gruppi vuoti', () => {
  const vino = (tipologia: DatiVino['tipologia']): DatiVino => ({ tipologia,formato: 'bottiglia',cantina: null,denominazione: null,annata: null })
  const voci = [{ n: 1,vino: vino('rosso') },{ n: 2,vino: vino('bollicine') },{ n: 3,vino: null },{ n: 4,vino: vino('rosso') }]
  expect(raggruppaVini(voci).map(g => [g.tipologia,g.voci.map(v => v.n)])).toEqual([['bollicine',[2]],['rosso',[1,4]],[null,[3]]])
})
