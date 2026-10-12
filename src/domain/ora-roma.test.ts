import { expect, it } from 'vitest'
import { dataRoma, dataValida, giornoSettimana, istanteRoma, oraRoma } from './ora-roma'
it('data e ora di Roma anche quando in UTC è ancora il giorno prima', () => {
  expect(dataRoma(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13')
  expect(oraRoma(new Date('2026-10-12T22:30:00Z'))).toBe('00:30')
  expect(oraRoma(new Date('2026-12-01T18:05:00Z'))).toBe('19:05')
})
it('istante di un orario di Roma, d’estate, d’inverno e nei giorni del cambio d’ora', () => {
  expect(istanteRoma('2026-10-12',19 * 60).toISOString()).toBe('2026-10-12T17:00:00.000Z')
  expect(istanteRoma('2026-10-26',19 * 60).toISOString()).toBe('2026-10-26T18:00:00.000Z')
  expect(istanteRoma('2026-10-25',19 * 60 + 15).toISOString()).toBe('2026-10-25T18:15:00.000Z')
  expect(istanteRoma('2026-10-25',60).toISOString()).toBe('2026-10-24T23:00:00.000Z')
  expect(istanteRoma('2027-03-28',12 * 60).toISOString()).toBe('2027-03-28T10:00:00.000Z')
  expect(istanteRoma('2027-03-28',60).toISOString()).toBe('2027-03-28T00:00:00.000Z')
})
it('giorno della settimana da lunedì (1) a domenica (7) e date valide', () => {
  expect(giornoSettimana('2026-10-12')).toBe(1)
  expect(giornoSettimana('2026-10-18')).toBe(7)
  expect(dataValida('2026-10-12')).toBe(true)
  for (const d of ['2026-02-30','2026-13-01','12/10/2026','',null]) expect(dataValida(d)).toBe(false)
})
