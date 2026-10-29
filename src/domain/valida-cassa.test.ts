import { expect, it } from 'vitest'
import { validaImpostazioniCassa, validaImpostazioniFiscali } from './valida-cassa'

it('legge il prezzo del coperto in euro, vuoto vale zero', () => {
  const nessuna = { banco: false,cucina: false,sala: false }
  expect(validaImpostazioniCassa({ coperto: '2,50' })).toEqual({ ok: true,dati: { copertoCent: 250,stampa: nessuna } })
  expect(validaImpostazioniCassa({ coperto: '' })).toEqual({ ok: true,dati: { copertoCent: 0,stampa: nessuna } })
  expect(validaImpostazioniCassa({ coperto: '0',stampaBanco: 'on',stampaCucina: 'on' })).toEqual({ ok: true,dati: { copertoCent: 0,stampa: { banco: true,cucina: true,sala: false } } })
  expect(validaImpostazioniCassa({ coperto: '20' })).toMatchObject({ ok: true })
  for (const coperto of ['20,01','-1','due','1.000,00']) expect(validaImpostazioniCassa({ coperto })).toMatchObject({ ok: false })
})
it('registratore: reparti da 1 a 99 per coperto, consegna e ogni categoria del DB', () => {
  const v = { repartoCoperto: '1',repartoConsegna: '2',indiceCarta: '1',automatico: 'on','reparto:sushi': '1','reparto:vini': '2' }
  expect(validaImpostazioniFiscali(v,['sushi','vini'])).toEqual({ ok: true,dati: { impostazioni: { repartoCoperto: 1,repartoConsegna: 2,indiceCarta: 1,automatico: true },categorie: { sushi: 1,vini: 2 } } })
  expect(validaImpostazioniFiscali({ ...v,'reparto:vini': '0' },['sushi','vini'])).toMatchObject({ ok: false })
  expect(validaImpostazioniFiscali(v,['sushi','vini','dessert'])).toMatchObject({ ok: false })
  expect(validaImpostazioniFiscali({ ...v,repartoCoperto: '100' },['sushi'])).toMatchObject({ ok: false })
  expect(validaImpostazioniFiscali({ ...v,indiceCarta: '' },['sushi'])).toMatchObject({ ok: false })
  // Categorie che non sono nel DB vengono ignorate.
  expect(validaImpostazioniFiscali(v,['sushi'])).toMatchObject({ ok: true,dati: { categorie: { sushi: 1 } } })
})
