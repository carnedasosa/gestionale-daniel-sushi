import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'
import { ADESSO, F1830, preparaCasa } from './casa-pronta'
import { spezzaSql } from '../../scripts/interroga-sql'
import { apriSessione, creaTavolo } from '@/tavoli/repo'
import { annullaOrdine, annullaRiga, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { accettaOrdine, avanzaOrdineCasa, creaOrdineCasa, rifiutaOrdine } from '@/casa/ordini-casa-repo'
import { avanzaComanda, portaComanda } from '@/comande/comande-repo'
import type { StatoComanda } from '@/domain/comande'

// Lo script si legge da disco e si spezza come fa scripts/interroga-sql.ts: se passa qui, quello script lo esegue.
const CONTROLLI = spezzaSql(readFileSync('scripts/sql/coerenza-ordini.sql','utf8'))
const etichetta = (sql: string) => /^-- \[(\w+)\]/.exec(sql)?.[1] ?? '?'
const UTENTE = '22222222-2222-4222-8222-222222222222'
type Reparto = 'banco' | 'cucina' | 'sala'
type Riga = Record<string,unknown>

let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
const piatti = {} as Record<Reparto,{ id: string; prezzo: number }>
const o: Record<string,string> = {}

/** Esegue tutti i controlli in una transazione di sola lettura, come lo script sul DB reale. */
async function controlla(): Promise<Record<string,Riga[]>> {
  const esiti: Record<string,Riga[]> = {}
  await ambiente.pg.exec('begin read only')
  try { for (const sql of CONTROLLI) esiti[etichetta(sql)] = (await ambiente.pg.query<Riga>(sql)).rows }
  finally { await ambiente.pg.exec('rollback') }
  return esiti
}
/** Solo i controlli con righe: id dell'ordine (più reparto se c'è) per controllo. */
async function segnalati(): Promise<Record<string,string[]>> {
  const esiti = await controlla()
  return Object.fromEntries(Object.entries(esiti).filter(([,righe]) => righe.length)
    .map(([k,righe]) => [k,righe.map(r => r.reparto ? `${r.id}/${r.reparto}` : String(r.id))]))
}
const q = (sql: string, parametri: unknown[] = []) => ambiente.db.query<Riga>(sql,parametri)
async function comanda(ordineId: string, reparto: Reparto) {
  const [c] = await ambiente.db.query<{ id: string; stato: StatoComanda }>('select id,stato from comande where ordine_id=$1 and reparto=$2',[ordineId,reparto])
  return c
}
async function riga(ordineId: string, reparto: Reparto) {
  const [r] = await ambiente.db.query<{ id: string }>('select id from righe_ordine where ordine_id=$1 and reparto=$2 limit 1',[ordineId,reparto])
  return r.id
}
async function tavolo(sessione: string, ...reparti: Reparto[]) {
  const e = await creaOrdineTavolo(ambiente.db,sessione,reparti.map(r => ({ piattoId: piatti[r].id,quantita: 1,nota: '' })),randomUUID())
  if (!e.ok) throw new Error(e.errore)
  return e.ordine.id
}
async function casa(tipo: 'asporto' | 'domicilio', zonaId: string, telefono: string, righe: [Reparto,number][]) {
  const righeCent = righe.reduce((s,[r,n]) => s + piatti[r].prezzo * n,0)
  const e = await creaOrdineCasa(ambiente.db,{ righe: righe.map(([r,n]) => ({ piattoId: piatti[r].id,quantita: n,nota: '' })),
    totaleVistoCent: righeCent + (tipo === 'domicilio' ? 200 : 0),chiaveInvio: randomUUID(),rete: null,adesso: ADESSO,prova: false,
    dati: { tipo,zonaId: tipo === 'domicilio' ? zonaId : null,indirizzo: tipo === 'domicilio' ? 'Via Roma 1, Bitetto' : null,noteConsegna: null,fascia: F1830,
      nome: 'Anna',telefono,email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null } })
  if (!e.ok) throw new Error(e.errore)
  return e.ordine.id
}
const vero = (v: unknown) => { if (!v) throw new Error('passo rifiutato dal repository') }

// Ordini in tutti gli stati, creati e portati avanti solo dai repository reali.
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const { db } = ambiente
  const { zona } = await preparaCasa(db)
  for (const p of await db.query<{ id: string; reparto: Reparto; prezzo: number }>(`select distinct on (c.reparto) p.id,c.reparto,p.prezzo_cent as prezzo
    from piatti p join categorie c on c.id=p.categoria_id where p.disponibile order by c.reparto,p.numero nulls last,p.nome`)) piatti[p.reparto] = p
  const t = await creaTavolo(db,'Tavolo 1','tavolo-1')
  const sessione = (await apriSessione(db,t.id)).id
  // Tavolo: inviato con tre reparti.
  o.inviato = await tavolo(sessione,'banco','cucina','sala')
  // Tavolo: banco avviato e bevande portate → in_preparazione.
  o.inPreparazione = await tavolo(sessione,'banco','cucina','sala')
  vero(await avanzaComanda(db,(await comanda(o.inPreparazione,'banco')).id,'da_preparare'))
  vero(await portaComanda(db,(await comanda(o.inPreparazione,'sala')).id))
  // Tavolo: banco e cucina pronti → servito.
  o.servito = await tavolo(sessione,'banco','cucina')
  for (const r of ['banco','cucina'] as const) {
    vero(await avanzaComanda(db,(await comanda(o.servito,r)).id,'da_preparare'))
    vero(await avanzaComanda(db,(await comanda(o.servito,r)).id,'in_preparazione'))
  }
  // Tavolo: riga di cucina annullata → comanda di cucina annullata, totale ricalcolato.
  o.rigaAnnullata = await tavolo(sessione,'banco','cucina')
  expect(await annullaRiga(db,await riga(o.rigaAnnullata,'cucina'),UTENTE)).toBe('ok')
  // Tavolo: annullato per intero (righe attive, comande annullate).
  o.annullato = await tavolo(sessione,'banco')
  expect(await annullaOrdine(db,o.annullato,UTENTE)).toBe('ok')
  // Tavolo: unica riga annullata → ordine annullato con totale 0.
  o.vuoto = await tavolo(sessione,'banco')
  expect(await annullaRiga(db,await riga(o.vuoto,'banco'),UTENTE)).toBe('ok')
  // Casa: in attesa, poi uno portato fino a pronto, uno rifiutato, un domicilio con bevanda (senza comanda sala).
  o.inAttesa = await casa('asporto',zona.id,'3331111111',[['banco',2]])
  o.pronto = await casa('asporto',zona.id,'3332222222',[['banco',2]])
  vero(await accettaOrdine(db,o.pronto,0))
  vero(await avanzaOrdineCasa(db,o.pronto,'accettato'))
  vero(await avanzaOrdineCasa(db,o.pronto,'in_preparazione'))
  o.rifiutato = await casa('asporto',zona.id,'3333333333',[['banco',2]])
  vero(await rifiutaOrdine(db,o.rifiutato,'Fascia piena'))
  o.domicilio = await casa('domicilio',zona.id,'3334444444',[['banco',3],['sala',1]])
  vero(await accettaOrdine(db,o.domicilio,0))
  vero(await avanzaComanda(db,(await comanda(o.domicilio,'banco')).id,'da_preparare'))
})
afterEach(async () => { await ambiente.pg.close() })

it('lo script si spezza in un controllo per interrogazione, ognuno con la sua etichetta', () => {
  expect(CONTROLLI.map(etichetta)).toEqual(['a','b','c1','c2','c3','d1','d2'])
})

it('ordini creati e portati avanti dai repository: ogni controllo restituisce zero righe', async () => {
  // I dati coprono davvero gli stati che i controlli guardano.
  const stati = Object.fromEntries((await q('select id,stato,totale_cent,consegna_cent from ordini')).map(r => [r.id,r]))
  expect(Object.fromEntries(Object.entries(o).map(([k,id]) => [k,stati[id].stato]))).toEqual({
    inviato: 'inviato',inPreparazione: 'in_preparazione',servito: 'servito',rigaAnnullata: 'inviato',annullato: 'annullato',vuoto: 'annullato',
    inAttesa: 'in_attesa',pronto: 'pronto',rifiutato: 'rifiutato',domicilio: 'in_preparazione',
  })
  expect(stati[o.vuoto].totale_cent).toBe(0)
  expect(stati[o.domicilio]).toMatchObject({ consegna_cent: 200,totale_cent: piatti.banco.prezzo * 3 + piatti.sala.prezzo + 200 })
  expect(await comanda(o.domicilio,'sala')).toBeUndefined()
  const esiti = await controlla()
  for (const [k,righe] of Object.entries(esiti)) expect(righe,`controllo ${k}`).toEqual([])
})

it('a: totale alterato o non azzerato senza righe attive', async () => {
  const [{ totale_cent: totale }] = await q('select totale_cent from ordini where id=$1',[o.inviato])
  await q('update ordini set totale_cent=totale_cent+1 where id=$1',[o.inviato])
  await q('update ordini set totale_cent=500 where id=$1',[o.vuoto])
  expect(await segnalati()).toEqual({ a: [o.inviato,o.vuoto] })
  const { a } = await controlla()
  expect(a.map(r => [r.id,Number(r.totale_trovato),Number(r.totale_atteso),r.righe_attive])).toEqual([[o.inviato,Number(totale) + 1,Number(totale),3],[o.vuoto,500,0,0]])
})

it('b: stato dell’ordine che non segue le comande', async () => {
  // Inviato con una comanda già pronta (andava in_preparazione).
  await q(`update comande set stato='pronta' where ordine_id=$1 and reparto='banco'`,[o.inviato])
  // In preparazione con tutte le comande pronte (andava servito).
  await q(`update ordini set stato='in_preparazione' where id=$1`,[o.servito])
  // Annullato con una comanda tornata attiva.
  await q(`update comande set stato='da_preparare' where ordine_id=$1`,[o.annullato])
  // Pronto con una comanda ancora in preparazione, in attesa con una comanda già avviata.
  await q(`update comande set stato='in_preparazione' where ordine_id=any($1::uuid[])`,[[o.pronto,o.inAttesa]])
  expect(await segnalati()).toEqual({ b: [o.inviato,o.servito,o.annullato,o.inAttesa,o.pronto] })
  const { b } = await controlla()
  expect(b.map(r => [r.id,r.stato_trovato,r.stato_atteso])).toEqual([
    [o.inviato,'inviato','in_preparazione'],
    [o.servito,'in_preparazione','servito'],
    [o.annullato,'annullato','annullato senza comande attive'],
    [o.inAttesa,'in_attesa','in_attesa con comande tutte da_preparare'],
    [o.pronto,'pronto','pronto con comande tutte pronte'],
  ])
})

it('c: comande e righe dei reparti che non si corrispondono', async () => {
  // Righe di cucina annullate senza annullare la comanda (né ricalcolare il totale).
  await q(`update righe_ordine set annullata=true where ordine_id=$1 and reparto='cucina'`,[o.inviato])
  // Comanda annullata con le righe ancora attive, comanda sparita.
  await q(`update comande set stato='annullata' where ordine_id=$1 and reparto='cucina'`,[o.inPreparazione])
  await q(`delete from comande where ordine_id=$1 and reparto='banco'`,[o.rigaAnnullata])
  // Comanda delle bevande in un ordine da casa.
  await q(`insert into comande (ordine_id,reparto) values ($1,'sala')`,[o.domicilio])
  expect(await segnalati()).toEqual({
    a: [o.inviato],
    c1: [`${o.inviato}/cucina`],
    c2: [`${o.inPreparazione}/cucina`,`${o.rigaAnnullata}/banco`],
    c3: [`${o.domicilio}/sala`],
  })
  const { c2 } = await controlla()
  expect(c2.map(r => r.stato_comanda)).toEqual(['annullata','nessuna comanda'])
})

it('d: chiavi d’invio e comande doppie le rifiutano già gli indici unici, il controllo resta vuoto', async () => {
  await expect(q('insert into ordini (sessione_id,totale_cent,chiave_invio) select sessione_id,totale_cent,chiave_invio from ordini where id=$1',[o.inviato])).rejects.toThrow(/unique|duplicate/i)
  await expect(q(`insert into comande (ordine_id,reparto) values ($1,'banco')`,[o.inviato])).rejects.toThrow(/unique|duplicate/i)
  expect(await segnalati()).toEqual({})
})
