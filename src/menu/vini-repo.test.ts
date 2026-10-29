import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { aggiornaPiatto, creaPiatto, leggiMenu, leggiPiatto, type DatiPiatto } from './repo'
import { validaPiatto } from './valida-piatto'

let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest({ seed: true }) })
afterEach(async () => { await ambiente.pg.close() })
const base: DatiPiatto = { nome: 'Falanghina',descrizione: null,prezzoCent: 2200,piccante: false,vegetariano: false,dellaCasa: false,allergeni: ['solfiti'],allergeniConfermati: true }
const falanghina = { tipologia: 'bianco' as const,formato: 'bottiglia' as const,cantina: 'Feudi di San Gregorio',denominazione: 'Falanghina del Sannio DOC',annata: 2024 }

it('la migrazione crea la carta dei vini vuota, in fondo e preparata dalla sala', async () => {
  const menu = await leggiMenu(ambiente.db)
  expect(menu.at(-1)).toMatchObject({ id: 'vini',nome: 'Carta dei vini',tipo: 'vini',reparto: 'sala',piatti: [] })
  expect(menu.filter(c => c.tipo === 'piatti')).toHaveLength(menu.length - 1)
})
it('crea un vino con i suoi campi, in fondo alla categoria; il calice è una voce a sé', async () => {
  const { db } = ambiente
  const a = await creaPiatto(db,'vini',null,{ ...base,vino: falanghina })
  const b = await creaPiatto(db,'vini',null,{ ...base,nome: 'Falanghina',prezzoCent: 500,vino: { ...falanghina,formato: 'calice' } })
  if (!a.ok || !b.ok) throw new Error('non creato')
  const vini = (await leggiMenu(db)).find(c => c.id === 'vini')!.piatti
  expect(vini.map(p => [p.prezzoCent,p.vino?.formato,p.posizione])).toEqual([[2200,'bottiglia',1],[500,'calice',2]])
  expect((await leggiPiatto(db,a.id))!.vino).toEqual(falanghina)
})
it('numero unico e categoria esistente; un piatto normale nasce senza vino', async () => {
  const { db } = ambiente
  expect(await creaPiatto(db,'tartare',1,base)).toEqual({ ok: false,errore: 'numero' })
  expect(await creaPiatto(db,'non-esiste',null,base)).toEqual({ ok: false,errore: 'categoria' })
  const nuovo = await creaPiatto(db,'tartare',900,{ ...base,nome: 'Tartare di ricciola',allergeni: ['pesce'] })
  if (!nuovo.ok) throw new Error(nuovo.errore)
  expect(await leggiPiatto(db,nuovo.id)).toMatchObject({ numero: 900,categoriaId: 'tartare',vino: null,disponibile: true })
})
it('modifica: senza campi del vino li lascia, con null li toglie; il DB rifiuta un vino a metà', async () => {
  const { db } = ambiente
  const a = await creaPiatto(db,'vini',null,{ ...base,vino: falanghina })
  if (!a.ok) throw new Error(a.errore)
  await aggiornaPiatto(db,a.id,{ ...base,prezzoCent: 2400 })
  expect(await leggiPiatto(db,a.id)).toMatchObject({ prezzoCent: 2400,vino: falanghina })
  await aggiornaPiatto(db,a.id,{ ...base,vino: { ...falanghina,annata: null,cantina: null } })
  expect((await leggiPiatto(db,a.id))!.vino).toEqual({ ...falanghina,annata: null,cantina: null })
  await aggiornaPiatto(db,a.id,{ ...base,vino: null })
  expect((await leggiPiatto(db,a.id))!.vino).toBeNull()
  await expect(db.query("update piatti set vino_tipologia='rosso' where id=$1",[a.id])).rejects.toThrow()
  await expect(db.query("update piatti set vino_cantina='X' where id=$1",[a.id])).rejects.toThrow()
})
it('il modulo con i campi del vino li valida insieme al resto', () => {
  const modulo = { nome: 'Primitivo',descrizione: '',prezzo: '24',piccante: false,vegetariano: false,dellaCasa: false,allergeni: ['solfiti'],allergeniConfermati: true }
  const vino = { conVino: true,vinoTipologia: 'rosso',vinoFormato: 'bottiglia',vinoCantina: 'Tormaresca',vinoDenominazione: '',vinoAnnata: '2022' }
  expect(validaPiatto({ ...modulo,...vino },2026)).toMatchObject({ ok: true,dati: { vino: { tipologia: 'rosso',annata: 2022,denominazione: null } } })
  expect(validaPiatto({ ...modulo,...vino,vinoAnnata: '3000' },2026)).toMatchObject({ ok: false,errori: { vinoAnnata: expect.any(String) } })
  const senza = validaPiatto(modulo,2026)
  expect(senza.ok && 'vino' in senza.dati).toBe(false)
})
