import { describe, expect, it } from 'vitest'
import { inputDaForm, validaPiatto, type InputPiatto } from './valida-piatto'

const base: InputPiatto = {
  nome: ' Salmone ', descrizione: '  ', prezzo: '2,50', piccante: false, vegetariano: false,
  dellaCasa: false, allergeni: ['sesamo', 'pesce'], allergeniConfermati: true,
}

describe('validaPiatto', () => {
  it('pulisce e converte', () => {
    expect(validaPiatto(base)).toEqual({
      ok: true,
      dati: {
        nome: 'Salmone', descrizione: null, prezzoCent: 250, piccante: false, vegetariano: false,
        dellaCasa: false, allergeni: ['pesce', 'sesamo'], allergeniConfermati: true,
      },
    })
  })
  it.each([['10,5', 1050], ['€ 10,50', 1050], ['10.50', 1050], ['10', 1000]])('prezzo %j accettato', (prezzo, cent) => {
    const r = validaPiatto({ ...base, prezzo })
    expect(r.ok && r.dati.prezzoCent).toBe(cent)
  })
  it.each(['', '-3', 'abc', '1,234'])('prezzo %j rifiutato con messaggio', (prezzo) => {
    const r = validaPiatto({ ...base, prezzo })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errori.prezzo).toBe('Scrivi il prezzo in euro, ad esempio 10,50')
  })
  it('nome obbligatorio e non troppo lungo', () => {
    const vuoto = validaPiatto({ ...base, nome: '   ' })
    expect(!vuoto.ok && vuoto.errori.nome).toBe('Il nome è obbligatorio')
    const lungo = validaPiatto({ ...base, nome: 'x'.repeat(121) })
    expect(!lungo.ok && lungo.errori.nome).toBe('Massimo 120 caratteri')
  })
  it('descrizione al massimo 500 caratteri', () => {
    const r = validaPiatto({ ...base, descrizione: 'x'.repeat(501) })
    expect(!r.ok && r.errori.descrizione).toBe('Massimo 500 caratteri')
  })
  it('allergene sconosciuto rifiutato', () => {
    const r = validaPiatto({ ...base, allergeni: ['pesce', 'avocado'] })
    expect(!r.ok && r.errori.allergeni).toBe('Allergene non valido')
  })
})

describe('inputDaForm', () => {
  it('legge checkbox e allergeni multipli', () => {
    const fd = new FormData()
    fd.set('nome', 'Tonno'); fd.set('descrizione', ''); fd.set('prezzo', '3')
    fd.set('piccante', 'on')
    fd.append('allergeni', 'pesce'); fd.append('allergeni', 'soia')
    expect(inputDaForm(fd)).toEqual({
      nome: 'Tonno', descrizione: '', prezzo: '3', piccante: true, vegetariano: false, dellaCasa: false,
      allergeni: ['pesce', 'soia'], allergeniConfermati: false,
    })
  })
})
