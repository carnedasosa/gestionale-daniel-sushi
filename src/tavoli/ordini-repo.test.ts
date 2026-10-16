import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import type { RigaCarrello } from '@/domain/carrello'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, creaTavolo, chiudiSessione } from './repo'
import { annullaOrdine, annullaRiga, annullaVoceConto, avanzaStato, contoSessione, creaOrdineTavolo as creaOrdine, ordiniAttivi, ordiniDellaSessione, riepiloghiTavoli } from './ordini-repo'
import { contiRecenti } from './repo'
import { leggiPokeConfig, salvaPokeConfig } from './poke-repo'
import { validaCarrello } from '@/domain/carrello'
const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatto: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 1','tavolo-1')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  piatto = (await ambiente.db.query<{ id: string }>('select id from piatti where numero=1'))[0].id
})
afterEach(async () => { await ambiente.pg.close() })
const righe = () => [{ piattoId: piatto, quantita: 2, nota: 'senza sesamo' }]
const creaOrdineTavolo = (db: Db,s: string,r: RigaCarrello[],key = randomUUID()) => creaOrdine(db,s,r,key)
it('chiusura avvisa, conserva la cucina e rende il conto recente raggiungibile', async () => {
  const { db } = ambiente
  const e = await creaOrdineTavolo(db,sessione,righe()); if (!e.ok) throw new Error(e.errore)
  expect(await chiudiSessione(db,sessione,null)).toEqual({ ok: false,motivo: 'ordini_in_cucina',n: 1 })
  expect(await chiudiSessione(db,sessione,null,true)).toEqual({ ok: true })
  expect(await ordiniAttivi(db)).toMatchObject([{ id: e.ordine.id,tavoloChiuso: true }])
  expect(await contiRecenti(db)).toMatchObject([{ id: sessione,tavoloNome: 'Tavolo 1' }])
  await db.query("update sessioni_tavolo set chiusa_il=now()-interval '7 hours' where id=$1",[sessione])
  expect(await contiRecenti(db)).toEqual([])
})
it('un ordine arrivato dopo il conto richiede conferma anche se è già servito', async () => {
  const { db } = ambiente
  const conto = (await contoSessione(db,sessione))!
  const e = await creaOrdineTavolo(db,sessione,righe()); if (!e.ok) throw new Error(e.errore)
  await avanzaStato(db,e.ordine.id,'inviato'); await avanzaStato(db,e.ordine.id,'in_preparazione')
  // La pagina si aggiorna da sola: il nuovo ordine compare negli ordini del conto...
  const aggiornato = (await contoSessione(db,sessione))!
  expect(aggiornato.ordiniIds.filter(id => !conto.ordiniIds.includes(id))).toEqual([e.ordine.id])
  // ...ma la chiusura usa ancora l'ora del primo conto visto dal cameriere.
  expect(await chiudiSessione(db,sessione,conto.vistoAlle)).toEqual({ ok: false,motivo: 'ordini_dopo_conto',n: 1 })
  expect(await chiudiSessione(db,sessione,aggiornato.vistoAlle)).toEqual({ ok: true })
})
it('conto: annulla una voce raggruppata anche servita e annulla ordini rimasti vuoti', async () => {
  const { db } = ambiente
  for (let i=0; i<2; i++) {
    const e = await creaOrdineTavolo(db,sessione,righe()); if (!e.ok) throw new Error(e.errore)
    await avanzaStato(db,e.ordine.id,'inviato'); await avanzaStato(db,e.ordine.id,'in_preparazione')
  }
  const c = (await contoSessione(db,sessione))!
  expect(c.voci[0]).toMatchObject({ quantita: 4,prezzoUnitCent: 600,poke: null })
  expect(await annullaVoceConto(db,sessione,c.voci[0],UTENTE)).toBe('ok')
  expect(await contoSessione(db,sessione)).toMatchObject({ totaleCent: 0,voci: [] })
  expect((await ordiniDellaSessione(db,sessione)).map(o => o.stato)).toEqual(['annullato','annullato'])
  expect(await annullaVoceConto(db,sessione,c.voci[0],UTENTE)).toBe('non_disponibile')
  expect(await annullaVoceConto(db,'x',c.voci[0],UTENTE)).toBe('non_disponibile')
})
it('poke differenti restano separate nel conto con le scelte e il prezzo unitario', async () => {
  const { db } = ambiente
  const c = (await leggiPokeConfig(db))!; c.prezzoBaseCent=900; c.prezzoExtraCent=100; await salvaPokeConfig(db,c)
  const poke = Object.fromEntries(c.gruppi.map(g => [g.nome,g.voci.slice(0,g.min)]))
  const altro = { ...poke,Base: [c.gruppi.find(g => g.nome==='Base')!.voci[1]] }
  await creaOrdineTavolo(db,sessione,[{ piattoId: null,quantita: 1,nota: '',poke },{ piattoId: null,quantita: 1,nota: '',poke: altro }])
  const voci = (await contoSessione(db,sessione))!.voci
  expect(voci).toHaveLength(2); expect(voci.map(v => v.poke)).toEqual(expect.arrayContaining([poke,altro]))
  await annullaVoceConto(db,sessione,voci[0],UTENTE)
  expect(await contoSessione(db,sessione)).toMatchObject({ totaleCent: 900,voci: [{ quantita: 1 }] })
})
it('ripete lo stesso invio senza duplicati, anche dopo chiusura, e non accetta chiavi di altre sessioni', async () => {
  const { db } = ambiente
  const key = randomUUID()
  const a = await creaOrdineTavolo(db,sessione,righe(),key)
  const b = await creaOrdineTavolo(db,sessione,righe(),key)
  expect(a).toMatchObject({ ok: true }); expect(b).toEqual(a)
  expect(await db.query('select * from ordini')).toHaveLength(1)
  await chiudiSessione(db,sessione,null,true)
  expect(await creaOrdineTavolo(db,sessione,righe(),key)).toMatchObject({ ok: true,ordine: { numero: a.ok ? a.ordine.numero : 0,tavoloChiuso: true } })
  const t = await creaTavolo(db,'Altro','altro'); const altra = await apriSessione(db,t.id)
  expect(await creaOrdineTavolo(db,altra.id,righe(),key)).toMatchObject({ ok: false })
  expect(await db.query('select * from ordini')).toHaveLength(1)
})
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
  await chiudiSessione(db,sessione,null,true)
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
  expect((await avanzaStato(db,e.ordine.id,'inviato'))?.stato).toBe('in_preparazione')
  expect((await avanzaStato(db,e.ordine.id,'in_preparazione'))?.stato).toBe('servito')
  expect(await avanzaStato(db,e.ordine.id,'servito' as never)).toBeNull()
  expect(await annullaOrdine(db,e.ordine.id,UTENTE)).toBe('non_disponibile')
  expect(await ordiniAttivi(db)).toEqual([])
})
it('annulla righe, ricalcola totale e raggruppa il conto escludendo annullati', async () => {
  const { db } = ambiente
  const a = await creaOrdineTavolo(db,sessione,righe()), b = await creaOrdineTavolo(db,sessione,righe()), c = await creaOrdineTavolo(db,sessione,righe())
  if (!a.ok || !b.ok || !c.ok) throw new Error('creazione')
  expect((await contoSessione(db,sessione))?.voci).toEqual([{ nome: 'Salmone', numero: 1, prezzoUnitCent: 600,poke: null,quantita: 6, importoCent: 3600 }])
  expect(await annullaRiga(db,a.ordine.righe[0].id,UTENTE)).toBe('ok')
  expect(await annullaRiga(db,a.ordine.righe[0].id,UTENTE)).toBe('non_disponibile')
  expect((await ordiniDellaSessione(db,sessione))[0].totaleCent).toBe(0)
  await annullaOrdine(db,b.ordine.id,UTENTE)
  expect(await contoSessione(db,sessione)).toMatchObject({ totaleCent: 1200, voci: [{ quantita: 2, importoCent: 1200 }] })
  expect(await contoSessione(db,'x')).toBeNull()
  expect(await annullaRiga(db,'x',UTENTE)).toBe('non_disponibile')
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
  await annullaOrdine(db,a.ordine.id,UTENTE)
  expect(await riepiloghiTavoli(db)).toEqual([{ sessioneId: sessione, numeroOrdini: 1, totaleCent: 1200 }])
})
it('un ordine misto con un esaurito non salva neppure le righe disponibili', async () => {
  const { db } = ambiente
  const [altro] = await db.query<{ id: string }>('select id from piatti where numero=2')
  await db.query('update piatti set disponibile=false where id=$1',[altro.id])
  expect((await creaOrdineTavolo(db,sessione,[...righe(),{ piattoId: altro.id,quantita: 1,nota: '' }])).ok).toBe(false)
  expect(await db.query('select * from ordini')).toEqual([])
  expect(await db.query('select * from righe_ordine')).toEqual([])
})
it('identifica per ID il solo esaurito anche se due piatti hanno lo stesso nome', async () => {
  const { db } = ambiente
  const [altro] = await db.query<{ id: string }>('select id from piatti where numero=2')
  await db.query('update piatti set nome=$2,disponibile=false where id=$1',[altro.id,'Salmone'])
  expect(await creaOrdineTavolo(db,sessione,[...righe(),{ piattoId: altro.id,quantita: 1,nota: '' }])).toMatchObject({
    ok: false, nonDisponibili: ['Salmone'], nonDisponibiliIds: [altro.id],
  })
  expect(await db.query('select * from ordini')).toEqual([])
})
it('annullamenti di righe in sequenza mantengono il totale e annullano l’ordine vuoto', async () => {
  const { db } = ambiente
  const e = await creaOrdineTavolo(db,sessione,[...righe(),...righe()]); if (!e.ok) throw new Error(e.errore)
  // PGlite serializza le transazioni; la concorrenza reale dipende dai lock SQL.
  const risultati = []
  for (const r of e.ordine.righe) risultati.push(await annullaRiga(db,r.id,UTENTE))
  expect(risultati).toEqual(['ok','ok'])
  expect((await ordiniDellaSessione(db,sessione))[0].totaleCent).toBe(0)
  expect((await ordiniDellaSessione(db,sessione))[0].stato).toBe('annullato')
})
it('avanza solo dallo stato visto dallo staff: un secondo tocco su «Inizia a preparare» non porta a servito', async () => {
  const { db } = ambiente
  const e = await creaOrdineTavolo(db,sessione,righe()); if (!e.ok) throw new Error(e.errore)
  // Due schermi mostrano la comanda «inviata» e la toccano entrambi.
  expect((await avanzaStato(db,e.ordine.id,'inviato'))?.stato).toBe('in_preparazione')
  expect(await avanzaStato(db,e.ordine.id,'inviato')).toBeNull()
  expect((await ordiniDellaSessione(db,sessione))[0].stato).toBe('in_preparazione')
  expect(await avanzaStato(db,e.ordine.id,'annullato' as never)).toBeNull()
  expect(await avanzaStato(db,e.ordine.id,'boh' as never)).toBeNull()
  expect((await avanzaStato(db,e.ordine.id,'in_preparazione'))?.stato).toBe('servito')
})
it('a conto chiuso voci, righe e ordini non si annullano più e il totale incassato resta quello', async () => {
  const { db } = ambiente
  const a = await creaOrdineTavolo(db,sessione,righe()), b = await creaOrdineTavolo(db,sessione,righe())
  if (!a.ok || !b.ok) throw new Error('creazione')
  await avanzaStato(db,a.ordine.id,'inviato'); await avanzaStato(db,a.ordine.id,'in_preparazione')
  // La cucina ha ancora b: il tavolo si chiude con conferma.
  expect(await chiudiSessione(db,sessione,null,true)).toEqual({ ok: true })
  const conto = (await contoSessione(db,sessione))!
  expect(await annullaVoceConto(db,sessione,conto.voci[0],UTENTE)).toBe('conto_chiuso')
  expect(await annullaRiga(db,a.ordine.righe[0].id,UTENTE)).toBe('conto_chiuso')
  expect(await annullaRiga(db,b.ordine.righe[0].id,UTENTE)).toBe('conto_chiuso')
  expect(await annullaOrdine(db,b.ordine.id,UTENTE)).toBe('conto_chiuso')
  expect(await contoSessione(db,sessione)).toMatchObject({ totaleCent: 2400,voci: [{ quantita: 4 }] })
  expect((await ordiniDellaSessione(db,sessione)).map(o => o.stato)).toEqual(['servito','inviato'])
  expect(await db.query('select * from registro_annullamenti')).toEqual([])
})
it('registra chi ha annullato cosa, quando e per quale importo', async () => {
  const { db } = ambiente
  const a = await creaOrdineTavolo(db,sessione,righe()), b = await creaOrdineTavolo(db,sessione,righe()), c = await creaOrdineTavolo(db,sessione,[{ piattoId: piatto,quantita: 1,nota: '' }])
  if (!a.ok || !b.ok || !c.ok) throw new Error('creazione')
  const altro = '33333333-3333-4333-8333-333333333333'
  const prima = new Date()
  expect(await annullaRiga(db,a.ordine.righe[0].id,UTENTE)).toBe('ok')
  expect(await annullaOrdine(db,b.ordine.id,altro)).toBe('ok')
  const voce = (await contoSessione(db,sessione))!.voci[0]
  expect(await annullaVoceConto(db,sessione,voce,UTENTE)).toBe('ok')
  expect(await db.query('select utente_id,tipo,ordine_id,riga_id,importo_cent from registro_annullamenti order by creato_il')).toEqual([
    { utente_id: UTENTE,tipo: 'riga',ordine_id: a.ordine.id,riga_id: a.ordine.righe[0].id,importo_cent: 1200 },
    { utente_id: altro,tipo: 'ordine',ordine_id: b.ordine.id,riga_id: null,importo_cent: 1200 },
    { utente_id: UTENTE,tipo: 'voce_conto',ordine_id: c.ordine.id,riga_id: c.ordine.righe[0].id,importo_cent: 600 },
  ])
  expect(await db.query("select bool_and(creato_il >= $1::timestamptz - interval '1 second') as recenti from registro_annullamenti",[prima])).toEqual([{ recenti: true }])
  // Senza un utente valido non si annulla nulla.
  expect(await annullaOrdine(db,c.ordine.id,'nessuno')).toBe('non_disponibile')
  // Il registro non si perde: gli ordini annullati non si possono eliminare.
  await expect(db.query('delete from ordini where id=$1',[b.ordine.id])).rejects.toThrow(/foreign key|violates/i)
})
it('origine: cliente se non indicata, cameriere quando lo staff ordina; stessa chiave, stesso ordine; tavolo chiuso rifiutato', async () => {
  const { db } = ambiente
  const cliente = await creaOrdineTavolo(db,sessione,righe())
  expect(cliente).toMatchObject({ ok: true,ordine: { origine: 'cliente' } })
  const key = randomUUID()
  const a = await creaOrdine(db,sessione,righe(),key,'cameriere')
  expect(a).toMatchObject({ ok: true,ordine: { origine: 'cameriere',totaleCent: 1200 } })
  expect(await creaOrdine(db,sessione,righe(),key,'cameriere')).toEqual(a)
  expect(await db.query<{ origine: string }>('select origine from ordini order by numero')).toEqual([{ origine: 'cliente' },{ origine: 'cameriere' }])
  expect((await ordiniDellaSessione(db,sessione)).map(o => o.origine)).toEqual(['cliente','cameriere'])
  await chiudiSessione(db,sessione,null,true)
  expect(await creaOrdine(db,sessione,righe(),randomUUID(),'cameriere')).toEqual({ ok: false,errore: 'Il tavolo è stato chiuso: chiedi al personale' })
  expect(await db.query('select id from ordini')).toHaveLength(2)
})
