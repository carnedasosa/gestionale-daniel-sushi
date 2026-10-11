import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, creaTavolo, chiudiSessione } from './repo'
import { annullaOrdine, annullaRiga, avanzaStato, contoSessione, creaOrdineTavolo, ordiniAttivi, ordiniDellaSessione, riepiloghiTavoli } from './ordini-repo'
import { leggiPokeConfig, salvaPokeConfig } from './poke-repo'
import { validaCarrello } from '@/domain/carrello'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatto: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 1','tavolo-1')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  piatto = (await ambiente.db.query<{ id: string }>('select id from piatti where numero=1'))[0].id
})
afterEach(async () => { await ambiente.pg.close() })
const righe = () => [{ piattoId: piatto, quantita: 2, nota: 'senza sesamo' }]
it('salva prezzi dal DB e copie storiche ignorando prezzo client', async () => {
  const { db } = ambiente
  const v = validaCarrello([{ ...righe()[0], prezzoCent: 1 }]); if (!v.ok) throw new Error(v.errore)
  const esito = await creaOrdineTavolo(db,sessione,v.righe)
  expect(esito).toMatchObject({ ok: true, ordine: { totaleCent: 1200, righe: [{ nome: 'Salmone', prezzoUnitCent: 600, nota: 'senza sesamo' }] } })
  await db.query('update piatti set nome=$2,prezzo_cent=900 where id=$1',[piatto,'Nuovo'])
  expect((await ordiniDellaSessione(db,sessione))[0].righe[0].nome).toBe('Salmone')
})
it('rifiuta esauriti, inesistenti e tavolo chiuso senza scrivere nulla', async () => {
  const { db } = ambiente
  await db.query('update piatti set disponibile=false where id=$1',[piatto])
  expect(await creaOrdineTavolo(db,sessione,righe())).toMatchObject({ ok: false, nonDisponibili: ['Salmone'] })
  expect((await creaOrdineTavolo(db,sessione,[{ ...righe()[0], piattoId: '00000000-0000-0000-0000-000000000000' }])).ok).toBe(false)
  await chiudiSessione(db,sessione)
  expect(await creaOrdineTavolo(db,sessione,righe())).toEqual({ ok: false, errore: 'Il tavolo è stato chiuso: chiedi al personale' })
  expect(await db.query('select * from ordini')).toEqual([])
})
it('poke solo con prezzi e scelte valide, calcolata dal server', async () => {
  const { db } = ambiente
  const c = (await leggiPokeConfig(db))!
  const poke = Object.fromEntries(c.gruppi.map(g => [g.nome,g.voci.slice(0,g.min)]))
  const r = [{ piattoId: null, quantita: 1, nota: '', poke }]
  expect((await creaOrdineTavolo(db,sessione,r)).ok).toBe(false)
  c.prezzoBaseCent = 900; c.prezzoExtraCent = 100; await salvaPokeConfig(db,c)
  expect(await creaOrdineTavolo(db,sessione,r)).toMatchObject({ ok: true, ordine: { totaleCent: 900, righe: [{ nome: 'Poke composta', prezzoUnitCent: 900, poke }] } })
  expect((await creaOrdineTavolo(db,sessione,[{ ...r[0], poke: { ...poke, Base: ['Inventata'] } }])).ok).toBe(false)
})
it('avanza fino a servito ed esclude ordini finali dalla cucina', async () => {
  const { db } = ambiente
  const e = await creaOrdineTavolo(db,sessione,righe()); if (!e.ok) throw new Error(e.errore)
  expect(await ordiniAttivi(db)).toHaveLength(1)
  expect((await avanzaStato(db,e.ordine.id))?.stato).toBe('in_preparazione')
  expect((await avanzaStato(db,e.ordine.id))?.stato).toBe('servito')
  expect(await avanzaStato(db,e.ordine.id)).toBeNull()
  expect(await annullaOrdine(db,e.ordine.id)).toBe(false)
  expect(await ordiniAttivi(db)).toEqual([])
})
it('annulla righe, ricalcola totale e raggruppa il conto escludendo annullati', async () => {
  const { db } = ambiente
  const a = await creaOrdineTavolo(db,sessione,righe()), b = await creaOrdineTavolo(db,sessione,righe()), c = await creaOrdineTavolo(db,sessione,righe())
  if (!a.ok || !b.ok || !c.ok) throw new Error('creazione')
  expect((await contoSessione(db,sessione))?.voci).toEqual([{ nome: 'Salmone', numero: 1, quantita: 6, importoCent: 3600 }])
  expect(await annullaRiga(db,a.ordine.righe[0].id)).toBe(true)
  expect(await annullaRiga(db,a.ordine.righe[0].id)).toBe(false)
  expect((await ordiniDellaSessione(db,sessione))[0].totaleCent).toBe(0)
  await annullaOrdine(db,b.ordine.id)
  expect(await contoSessione(db,sessione)).toMatchObject({ totaleCent: 1200, voci: [{ quantita: 2, importoCent: 1200 }] })
  expect(await contoSessione(db,'x')).toBeNull()
  expect(await annullaRiga(db,'x')).toBe(false)
})
it('effettua rollback se la scrittura di una riga fallisce', async () => {
  const { db } = ambiente
  await db.query("create function rifiuta_riga() returns trigger language plpgsql as $$ begin raise exception 'errore simulato'; end $$")
  await db.query('create trigger rifiuta before insert on righe_ordine for each row execute function rifiuta_riga()')
  await expect(creaOrdineTavolo(db,sessione,righe())).rejects.toThrow('errore simulato')
  expect(await db.query('select * from ordini')).toEqual([])
})
it('riepiloghi staff: numero ordini e totale senza annullati', async () => {
  const { db } = ambiente
  const a = await creaOrdineTavolo(db,sessione,righe()), b = await creaOrdineTavolo(db,sessione,righe())
  if (!a.ok || !b.ok) throw new Error('creazione')
  await annullaOrdine(db,a.ordine.id)
  expect(await riepiloghiTavoli(db)).toEqual([{ sessioneId: sessione, numeroOrdini: 2, totaleCent: 1200 }])
})
