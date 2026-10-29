import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, chiudiSessione, creaTavolo, elencoTavoli, impostaCoperti } from './repo'
import { contoSessione, creaOrdineTavolo, riepiloghiTavoli } from './ordini-repo'
import { leggiImpostazioniCassa, salvaImpostazioniCassa } from '@/cassa/impostazioni-repo'

const SPENTA = { banco: false,cucina: false,sala: false }
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatto: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 1','tavolo-1')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  piatto = (await ambiente.db.query<{ id: string }>('select id,prezzo_cent from piatti where numero=1'))[0].id
})
afterEach(async () => { await ambiente.pg.close() })

it('il coperto entra nel conto e nel riepilogo del tavolo con lo stesso totale', async () => {
  const { db } = ambiente
  expect(await leggiImpostazioniCassa(db)).toEqual({ copertoCent: 0,stampa: { banco: false,cucina: false,sala: false } })
  await salvaImpostazioniCassa(db,{ copertoCent: 250,stampa: SPENTA })
  const e = await creaOrdineTavolo(db,sessione,[{ piattoId: piatto,quantita: 2,nota: '' }],randomUUID()); if (!e.ok) throw new Error(e.errore)
  expect(await impostaCoperti(db,sessione,4)).toBe('ok')
  const conto = (await contoSessione(db,sessione))!
  expect(conto).toMatchObject({ coperti: 4,copertoCent: 250,copertiCent: 1000,totaleCent: e.ordine.totaleCent + 1000 })
  const [riepilogo] = await riepiloghiTavoli(db)
  expect(riepilogo.totaleCent).toBe(conto.totaleCent)
  expect((await elencoTavoli(db))[0].sessione).toMatchObject({ coperti: 4 })
})
it('il prezzo si fissa alla prima volta: cambiarlo in admin non tocca i tavoli già segnati', async () => {
  const { db } = ambiente
  await salvaImpostazioniCassa(db,{ copertoCent: 200,stampa: SPENTA })
  await impostaCoperti(db,sessione,2)
  await salvaImpostazioniCassa(db,{ copertoCent: 300,stampa: SPENTA })
  await impostaCoperti(db,sessione,3)
  expect(await contoSessione(db,sessione)).toMatchObject({ coperti: 3,copertoCent: 200,copertiCent: 600 })
  // Tolti i coperti, la volta dopo si prende il prezzo nuovo.
  expect(await impostaCoperti(db,sessione,null)).toBe('ok')
  expect(await contoSessione(db,sessione)).toMatchObject({ coperti: null,copertoCent: null,copertiCent: 0,totaleCent: 0 })
  await impostaCoperti(db,sessione,1)
  expect(await contoSessione(db,sessione)).toMatchObject({ copertoCent: 300 })
})
it('coperti senza addebito, valori fuori scala e tavolo chiuso', async () => {
  const { db } = ambiente
  await impostaCoperti(db,sessione,5)
  expect(await contoSessione(db,sessione)).toMatchObject({ coperti: 5,copertoCent: 0,copertiCent: 0 })
  for (const n of [0,100,1.5]) expect(await impostaCoperti(db,sessione,n)).toBe('non_disponibile')
  expect(await impostaCoperti(db,'x',2)).toBe('non_disponibile')
  expect(await impostaCoperti(db,randomUUID(),2)).toBe('non_disponibile')
  await chiudiSessione(db,sessione)
  expect(await impostaCoperti(db,sessione,2)).toBe('conto_chiuso')
  await expect(db.query('update sessioni_tavolo set coperti=2,coperto_cent=null where id=$1',[sessione])).rejects.toThrow()
})
