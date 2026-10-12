import { expect, it } from 'vitest'
import { attesaLunga, azioneAvanzaCasa, colonnaCucina, etichettaClienteCasa, motivoRifiuto, prossimoStatoCasa, puoAnnullareCasa, STATI_CASA } from './stati-casa'
it('asporto e domicilio seguono i loro passaggi; rifiutati, completati e annullati si fermano', () => {
  expect(prossimoStatoCasa('asporto','accettato')).toBe('in_preparazione')
  expect(prossimoStatoCasa('asporto','in_preparazione')).toBe('pronto')
  expect(prossimoStatoCasa('asporto','pronto')).toBe('completato')
  expect(prossimoStatoCasa('domicilio','pronto')).toBe('in_consegna')
  expect(prossimoStatoCasa('domicilio','in_consegna')).toBe('completato')
  for (const s of ['in_attesa','rifiutato','completato','annullato'] as const) expect(prossimoStatoCasa('domicilio',s)).toBeNull()
})
it('si annulla solo dopo l’accettazione e prima del completamento', () => {
  expect(STATI_CASA.filter(puoAnnullareCasa)).toEqual(['accettato','in_preparazione','pronto','in_consegna'])
})
it('testi per staff e cliente', () => {
  expect(azioneAvanzaCasa('asporto','pronto')).toBe('Ritirato')
  expect(azioneAvanzaCasa('domicilio','pronto')).toBe('Partito')
  expect(azioneAvanzaCasa('domicilio','in_consegna')).toBe('Consegnato')
  expect(azioneAvanzaCasa('domicilio','accettato')).toBe('In preparazione')
  expect(azioneAvanzaCasa('domicilio','in_attesa')).toBeNull()
  expect(etichettaClienteCasa('asporto','pronto')).toBe('Pronto per il ritiro')
  expect(etichettaClienteCasa('domicilio','completato')).toBe('Consegnato')
  expect(etichettaClienteCasa('asporto','in_attesa')).toBe('In attesa di conferma')
})
it('colonne della cucina per tavoli e casa', () => {
  expect(['inviato','accettato','in_preparazione','pronto','in_consegna','servito','in_attesa','completato'].map(colonnaCucina))
    .toEqual(['da_preparare','da_preparare','in_preparazione','pronti','pronti',null,null,null])
})
it('motivi di rifiuto: rapidi oppure «Altro» con testo', () => {
  expect(motivoRifiuto('Fascia piena','')).toBe('Fascia piena')
  expect(motivoRifiuto('Altro','  Manca il fattorino ')).toBe('Manca il fattorino')
  for (const [m,a] of [['Altro','  '],['Altro','x'.repeat(201)],['Inventato',''],[null,null]]) expect(motivoRifiuto(m,a)).toBeNull()
})
it('attesa lunga oltre i 10 minuti', () => {
  expect(attesaLunga('2026-10-12T18:00:00Z',new Date('2026-10-12T18:10:00Z'))).toBe(false)
  expect(attesaLunga('2026-10-12T18:00:00Z',new Date('2026-10-12T18:10:01Z'))).toBe(true)
})
