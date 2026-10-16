import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'

// Senza seed, dati a mano: la migrazione si prova sullo schema di prima, come in produzione.
const file = '20261018120000_comande_reparto.sql'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessioneId: string, contatore = 0
async function ordineTavolo(stato: string) {
  const [o] = await ambiente.db.query<{ id: string }>(`insert into ordini (sessione_id,totale_cent,stato,aggiornato_il) values ($1,1000,$2,'2026-10-12T18:30:00Z') returning id`,[sessioneId,stato])
  return o.id
}
async function ordineCasa(stato: string) {
  const token = `abcdefghijklmnopqrstuvwxyz${String(contatore++).padStart(6,'0')}`
  const [o] = await ambiente.db.query<{ id: string }>(`insert into ordini (tipo,stato,totale_cent,token,fascia,cliente_nome,cliente_telefono,cliente_email,consegna_cent,pagamento,privacy_il,motivo_rifiuto)
    values ('asporto',$1,1000,$2,'2026-10-12T17:15:00Z','Anna','3331234567','anna@esempio.it',0,'carta','2026-10-12T16:00:00Z',$3) returning id`,[stato,token,stato === 'rifiutato' ? 'Fascia piena' : null])
  return o.id
}
async function righe(ordineId: string, ...reparti: (string | [string,boolean])[]) {
  for (const [i,r] of reparti.entries()) {
    const [reparto,annullata] = typeof r === 'string' ? [r,false] : r
    await ambiente.db.query(`insert into righe_ordine (ordine_id,nome,prezzo_unit_cent,quantita,posizione,reparto,annullata) values ($1,'Piatto',500,1,$2,$3,$4)`,[ordineId,i,reparto,annullata])
  }
}
const comande = async (ordineId: string) => ambiente.db.query<{ reparto: string; stato: string; pronta: boolean; portata: boolean; iniziata: boolean }>(
  `select reparto,stato,pronta_il is not null as pronta,portata_il is not null as portata,iniziata_il is not null as iniziata from comande where ordine_id=$1 order by reparto`,[ordineId])
const ids: Record<string,string> = {}
beforeEach(async () => {
  ambiente = await creaDbDiTest({ primaDi: file })
  const [t] = await ambiente.db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
  ;[{ id: sessioneId }] = await ambiente.db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
  for (const stato of ['inviato','in_preparazione','servito','annullato']) { ids[stato] = await ordineTavolo(stato); await righe(ids[stato],'banco','cucina','banco') }
  for (const stato of ['in_attesa','accettato','rifiutato','pronto','completato']) { ids[stato] = await ordineCasa(stato); await righe(ids[stato],'banco','sala') }
  ids.mezzo = await ordineTavolo('inviato'); await righe(ids.mezzo,'banco',['cucina',true],['cucina',true])
  ids.vuoto = await ordineTavolo('inviato')
  await ambiente.pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
})
afterEach(async () => { await ambiente.pg.close() })

it('backfill: una comanda per reparto, con lo stato coerente con l’ordine', async () => {
  expect((await comande(ids.inviato)).map(c => [c.reparto,c.stato,c.iniziata])).toEqual([['banco','da_preparare',false],['cucina','da_preparare',false]])
  expect((await comande(ids.in_preparazione)).map(c => [c.reparto,c.stato,c.iniziata,c.pronta])).toEqual([['banco','in_preparazione',true,false],['cucina','in_preparazione',true,false]])
  expect(await comande(ids.servito)).toEqual([{ reparto: 'banco',stato: 'pronta',pronta: true,portata: true,iniziata: true },{ reparto: 'cucina',stato: 'pronta',pronta: true,portata: true,iniziata: true }])
  expect((await comande(ids.annullato)).map(c => c.stato)).toEqual(['annullata','annullata'])
  // Da casa le bevande non hanno comanda: le insacchetta la cassa.
  expect((await comande(ids.in_attesa)).map(c => [c.reparto,c.stato])).toEqual([['banco','da_preparare']])
  expect((await comande(ids.accettato)).map(c => c.stato)).toEqual(['da_preparare'])
  expect((await comande(ids.rifiutato)).map(c => c.stato)).toEqual(['annullata'])
  for (const s of ['pronto','completato']) expect((await comande(ids[s])).map(c => [c.stato,c.portata])).toEqual([['pronta',true]])
})
it('backfill: reparto con tutte le righe annullate → annullata; ordine senza righe → nessuna comanda', async () => {
  expect((await comande(ids.mezzo)).map(c => [c.reparto,c.stato])).toEqual([['banco','da_preparare'],['cucina','annullata']])
  expect(await comande(ids.vuoto)).toEqual([])
})
it('una sola comanda per reparto, stati e reparti controllati, si cancella con l’ordine', async () => {
  await expect(ambiente.db.query(`insert into comande (ordine_id,reparto) values ($1,'banco')`,[ids.inviato])).rejects.toThrow(/unique|duplicate/i)
  await expect(ambiente.db.query(`insert into comande (ordine_id,reparto) values ($1,'bar')`,[ids.vuoto])).rejects.toThrow(/check/)
  await expect(ambiente.db.query(`insert into comande (ordine_id,reparto,stato) values ($1,'banco','servita')`,[ids.vuoto])).rejects.toThrow(/check/)
  const [{ stato }] = await ambiente.db.query<{ stato: string }>(`insert into comande (ordine_id,reparto) values ($1,'sala') returning stato`,[ids.vuoto])
  expect(stato).toBe('da_preparare')
  await ambiente.db.query('delete from registro_annullamenti')
  await ambiente.db.query('delete from righe_ordine where ordine_id=$1',[ids.inviato])
  await ambiente.db.query('delete from ordini where id=$1',[ids.inviato])
  expect(await comande(ids.inviato)).toEqual([])
})
