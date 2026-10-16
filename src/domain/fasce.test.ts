import { expect, it } from 'vitest'
import { fasceDelGiorno, fasceFuture, fascePrenotabili, fasciaPrenotabile, minutiDa, servizioValido } from './fasce'
import { oraRoma } from './ora-roma'
const regole = { capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30 }
const ore = (fasce: Date[]) => fasce.map(oraRoma)
it('orari validi, anche nel formato del database', () => {
  expect(minutiDa('19:30')).toBe(1170); expect(minutiDa('19:30:00')).toBe(1170); expect(minutiDa('00:00')).toBe(0)
  for (const x of ['24:00','7:30','19:60','19:30:15','',null]) expect(minutiDa(x)).toBeNull()
  expect(servizioValido('domicilio')).toBe(true); expect(servizioValido('tavolo')).toBe(false)
})
it('fasce ogni 15 minuti, l’ultima prima della chiusura, turni sovrapposti fusi', () => {
  expect(ore(fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '20:00' }]))).toEqual(['19:00','19:15','19:30','19:45'])
  expect(ore(fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '19:40' },{ dalle: '19:30',alle: '20:00' },{ dalle: '12:00',alle: '12:20' }])))
    .toEqual(['12:00','12:15','19:00','19:15','19:30','19:45'])
  expect(fasceDelGiorno('2026-10-12',[{ dalle: 'x',alle: '20:00' }])).toEqual([])
})
it('nel giorno del cambio d’ora le fasce restano alle ore di Roma', () => {
  const fasce = fasceDelGiorno('2026-10-25',[{ dalle: '19:00',alle: '19:30' }])
  expect(fasce.map(f => f.toISOString())).toEqual(['2026-10-25T18:00:00.000Z','2026-10-25T18:15:00.000Z'])
})
it('prenotabile solo con l’anticipo minimo e sotto le due capacità', () => {
  const adesso = new Date('2026-10-12T16:40:00Z') // 18:40 a Roma
  const f = (ora: string) => new Date(`2026-10-12T${ora}:00+02:00`)
  expect(fasciaPrenotabile('asporto',f('19:00'),{ totale: 0,domicilio: 0 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 0,domicilio: 0 },regole,adesso)).toBe(true)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 2,domicilio: 0 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 1,domicilio: 1 },regole,adesso)).toBe(true)
  expect(fasciaPrenotabile('domicilio',f('19:15'),{ totale: 1,domicilio: 1 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('domicilio',f('19:15'),{ totale: 1,domicilio: 0 },{ ...regole,capacitaConsegne: 0 },adesso)).toBe(false)
})
it('elenco delle prenotabili con l’occupazione del database', () => {
  const fasce = fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '20:00' }])
  const occupazione = [{ fascia: '2026-10-12T17:15:00.000Z',totale: 1,domicilio: 1 },{ fascia: '2026-10-12T17:30:00.000Z',totale: 2,domicilio: 0 }]
  const adesso = new Date('2026-10-12T16:00:00Z')
  expect(ore(fascePrenotabili('asporto',fasce,occupazione,regole,adesso))).toEqual(['19:00','19:15','19:45'])
  expect(ore(fascePrenotabili('domicilio',fasce,occupazione,regole,adesso))).toEqual(['19:00','19:45'])
})
import { fascePiene } from './fasce'
it('fascePiene: solo le fasce dopo l’anticipo scartate per capacità', () => {
  const adesso = new Date('2026-10-14T17:00:00.000Z'), r = { capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30 }
  const f = ['17:15','17:30','17:45','18:00'].map(o => new Date(`2026-10-14T${o}:00.000Z`))
  const occ = [{ fascia: '2026-10-14T17:15:00.000Z',totale: 2,domicilio: 0 },{ fascia: '2026-10-14T17:30:00.000Z',totale: 2,domicilio: 1 },{ fascia: '2026-10-14T17:45:00.000Z',totale: 1,domicilio: 1 }]
  expect(fascePiene('asporto',f,occ,r,adesso).map(d => d.toISOString())).toEqual(['2026-10-14T17:30:00.000Z'])
  expect(fascePiene('domicilio',f,occ,r,adesso).map(d => d.toISOString())).toEqual(['2026-10-14T17:30:00.000Z','2026-10-14T17:45:00.000Z'])
})
it('fasce future: quelle non ancora iniziate, anche piene o dentro l’anticipo', () => {
  const fasce = fasceDelGiorno('2026-10-12',[{ dalle: '18:30',alle: '19:30' }])
  expect(ore(fasceFuture(fasce,new Date('2026-10-12T16:45:00Z')))).toEqual(['18:45','19:00','19:15'])
  expect(ore(fasceFuture(fasce,new Date('2026-10-12T16:46:00Z')))).toEqual(['19:00','19:15'])
  expect(fasceFuture(fasce,new Date('2026-10-12T18:00:00Z'))).toEqual([])
})
