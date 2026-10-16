import { expect, it } from 'vitest'
import { azioneAvanzaComanda, colonnaComanda, comandeInCascata, prossimoStatoComanda, statoComandaValido, statoOrdineDaComande, type StatoComanda } from './comande'
it('passi della comanda: banco e cucina in due tocchi, le bevande in uno', () => {
  for (const r of ['banco','cucina'] as const) {
    expect(prossimoStatoComanda('da_preparare',r)).toBe('in_preparazione'); expect(prossimoStatoComanda('in_preparazione',r)).toBe('pronta')
    expect(prossimoStatoComanda('pronta',r)).toBeNull(); expect(prossimoStatoComanda('annullata',r)).toBeNull()
  }
  expect(prossimoStatoComanda('da_preparare','sala')).toBe('pronta'); expect(prossimoStatoComanda('in_preparazione','sala')).toBe('pronta'); expect(prossimoStatoComanda('pronta','sala')).toBeNull()
})
it('bottoni e colonne della comanda', () => {
  expect(azioneAvanzaComanda('da_preparare','banco')).toBe('Inizia a preparare'); expect(azioneAvanzaComanda('in_preparazione','cucina')).toBe('Segna pronta')
  expect(azioneAvanzaComanda('da_preparare','sala')).toBe('Portate'); expect(azioneAvanzaComanda('pronta','banco')).toBeNull()
  expect(colonnaComanda('pronta')).toBe('pronta'); expect(colonnaComanda('annullata')).toBeNull()
  expect(statoComandaValido('pronta')).toBe(true); expect(statoComandaValido('servito')).toBe(false)
})
it('stato del tavolo dalle comande', () => {
  const t = (attuale: string, stati: StatoComanda[]) => statoOrdineDaComande('tavolo',attuale,stati)
  expect(t('inviato',['da_preparare','da_preparare'])).toBeNull()
  expect(t('inviato',['in_preparazione','da_preparare'])).toBe('in_preparazione')
  expect(t('inviato',['pronta','da_preparare'])).toBe('in_preparazione')
  expect(t('in_preparazione',['pronta','pronta'])).toBe('servito')
  expect(t('in_preparazione',['pronta','annullata'])).toBe('servito')
  expect(t('in_preparazione',['da_preparare','annullata'])).toBe('inviato')
  expect(t('in_preparazione',['annullata'])).toBeNull()
  expect(t('in_preparazione',[])).toBeNull()
  // Passaggi della cassa: le comande non li toccano.
  expect(t('servito',['da_preparare'])).toBeNull(); expect(t('annullato',['pronta'])).toBeNull()
})
it('stato dell’ordine da casa dalle comande, solo dopo l’accettazione e fino a pronto', () => {
  for (const tipo of ['asporto','domicilio'] as const) {
    expect(statoOrdineDaComande(tipo,'accettato',['in_preparazione'])).toBe('in_preparazione')
    expect(statoOrdineDaComande(tipo,'in_preparazione',['pronta','pronta'])).toBe('pronto')
    expect(statoOrdineDaComande(tipo,'accettato',['pronta','pronta'])).toBe('pronto')
    expect(statoOrdineDaComande(tipo,'in_preparazione',['da_preparare'])).toBe('accettato')
    for (const s of ['in_attesa','rifiutato','pronto','in_consegna','completato','annullato']) expect(statoOrdineDaComande(tipo,s,['pronta'])).toBeNull()
  }
})
it('cascata dalla cassa sulle comande', () => {
  expect(comandeInCascata('in_preparazione')).toEqual({ da: ['da_preparare'],verso: 'in_preparazione' })
  expect(comandeInCascata('servito')).toEqual({ da: ['da_preparare','in_preparazione'],verso: 'pronta' })
  expect(comandeInCascata('pronto')).toEqual({ da: ['da_preparare','in_preparazione'],verso: 'pronta' })
  expect(comandeInCascata('annullato')).toEqual({ da: ['da_preparare','in_preparazione','pronta'],verso: 'annullata' })
  expect(comandeInCascata('rifiutato')).toEqual(comandeInCascata('annullato'))
  for (const s of ['inviato','accettato','in_consegna','completato','in_attesa']) expect(comandeInCascata(s)).toBeNull()
})
