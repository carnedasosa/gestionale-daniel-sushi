import { describe, expect, it } from 'vitest'
import { testoAllergeni } from './testo-allergeni'

describe('testoAllergeni', () => {
  it('elenca gli allergeni confermati in italiano', () => {
    expect(testoAllergeni({ allergeni: ['pesce', 'soia', 'sesamo'], allergeniConfermati: true })).toBe('Allergeni: Pesce, Soia, Semi di sesamo')
  })
  it('dichiara l’assenza solo se confermata', () => {
    expect(testoAllergeni({ allergeni: [], allergeniConfermati: true })).toBe('Nessuno dei 14 allergeni')
  })
  it('se non confermati rimanda al personale, anche se qualcosa è già segnato', () => {
    const atteso = 'Allergeni in verifica: chiedi al personale prima di ordinare'
    expect(testoAllergeni({ allergeni: [], allergeniConfermati: false })).toBe(atteso)
    expect(testoAllergeni({ allergeni: ['pesce'], allergeniConfermati: false })).toBe(atteso)
  })
})
