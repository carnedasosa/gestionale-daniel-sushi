import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import type { DatiCheckout } from '@/domain/checkout'
import type { RigaCarrello } from '@/domain/carrello'
import { aggiungiOrario, creaZona, impostaApertura, salvaImpostazioni, type Zona } from './impostazioni-repo'
import { accettaOrdine, anonimizzaOrdiniCasa, annullaOrdineCasa, avanzaOrdineCasa, creaOrdineCasa, ordineCasaPerToken, ordiniCasaAttivi, rifiutaOrdine, type InputOrdineCasa } from './ordini-casa-repo'
import { annullaRiga, ordiniAttivi } from '@/tavoli/ordini-repo'
import { leggiPokeConfig, salvaAllergeniPoke, salvaPokeConfig, leggiAllergeniPoke } from '@/tavoli/poke-repo'
const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, piatto: string, zona: Zona
// Lunedì 12/10/2026 alle 18:00 di Roma; prima fascia prenotabile: 18:30 (16:30 UTC).
const ADESSO = new Date('2026-10-12T16:00:00Z')
const F1830 = new Date('2026-10-12T16:30:00.000Z'), F1845 = new Date('2026-10-12T16:45:00.000Z')
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const { db } = ambiente
  await db.query('update piatti set allergeni_confermati=true')
  await salvaImpostazioni(db,{ capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '20:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '20:00' })
  zona = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
  piatto = (await db.query<{ id: string }>('select id from piatti where numero=1'))[0].id // 6,00 €
})
afterEach(async () => { await ambiente.pg.close() })
const asporto: DatiCheckout = { tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: F1830,nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null }
const domicilio = (): DatiCheckout => ({ ...asporto,tipo: 'domicilio',zonaId: zona.id,indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi' })
const righe = (quantita = 2): RigaCarrello[] => [{ piattoId: piatto,quantita,nota: 'senza sesamo' }]
const invia = (diverso: Partial<InputOrdineCasa> = {}) => creaOrdineCasa(ambiente.db,{ righe: righe(),dati: asporto,totaleVistoCent: 1200,chiaveInvio: randomUUID(),rete: '192.0.2.1',adesso: ADESSO,prova: false,...diverso })
async function crea(diverso: Partial<InputOrdineCasa> = {}) { const e = await invia(diverso); if (!e.ok) throw new Error(e.errore); return e.ordine }
it('asporto: ordine in attesa con token, righe copiate ed email «ricevuto» in coda', async () => {
  const o = await crea()
  expect(o).toMatchObject({ tipo: 'asporto',stato: 'in_attesa',totaleCent: 1200,consegnaCent: 0,clienteNome: 'Anna',zonaNome: null,pagamento: 'carta',anonimizzato: false })
  expect(o.token).toMatch(/^[A-Za-z0-9_-]{32}$/); expect(o.fascia.toISOString()).toBe(F1830.toISOString())
  expect(o.righe).toMatchObject([{ nome: expect.any(String),prezzoUnitCent: 600,quantita: 2,nota: 'senza sesamo' }])
  expect(await ambiente.db.query('select tipo from email_ordini')).toEqual([{ tipo: 'ricevuto' }])
  expect(await ordineCasaPerToken(ambiente.db,o.token)).toMatchObject({ id: o.id })
  expect(await ordineCasaPerToken(ambiente.db,'corto')).toBeNull()
})
it('lo stesso invio ripetuto restituisce lo stesso ordine', async () => {
  const chiaveInvio = randomUUID()
  const a = await crea({ chiaveInvio }), b = await crea({ chiaveInvio })
  expect(b.id).toBe(a.id); expect(await ambiente.db.query('select id from ordini')).toHaveLength(1)
})
it('totale cambiato, contanti insufficienti e piatto esaurito: nessun ordine', async () => {
  expect(await invia({ totaleVistoCent: 1000 })).toMatchObject({ ok: false,campo: 'carrello',totaleCent: 1200,errore: expect.stringContaining('I prezzi sono cambiati') })
  expect(await invia({ dati: { ...asporto,pagamento: 'contanti',contantiDaCent: 1000 } })).toMatchObject({ ok: false,campo: 'contantiDa' })
  await ambiente.db.query('update piatti set disponibile=false where id=$1',[piatto])
  expect(await invia()).toMatchObject({ ok: false,campo: 'carrello',nonDisponibiliIds: [piatto] })
  expect(await ambiente.db.query('select id from ordini')).toEqual([])
})
it('domicilio: minimo della zona, costo di consegna e zona copiata', async () => {
  expect(await invia({ dati: domicilio(),righe: righe(1),totaleVistoCent: 800 })).toMatchObject({ ok: false,errore: 'Mancano 9,00 € per l’ordine minimo di Bitetto.' })
  const o = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  expect(o).toMatchObject({ tipo: 'domicilio',totaleCent: 2000,consegnaCent: 200,zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi' })
  await ambiente.db.query('update zone_consegna set attiva=false')
  expect(await invia({ dati: { ...domicilio(),fascia: F1845 },righe: righe(3),totaleVistoCent: 2000 })).toMatchObject({ ok: false,campo: 'tipo',errore: 'Consegne a domicilio non disponibili.' })
})
it('capacità: tetto consegne e totale per fascia', async () => {
  await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  const pieno = await invia({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  expect(pieno).toMatchObject({ ok: false,campo: 'fascia' })
  if (!pieno.ok) expect(pieno.fasce).not.toContain(F1830.toISOString())
  await crea()
  expect(await invia()).toMatchObject({ ok: false,campo: 'fascia' })
  // Un ordine rifiutato libera il posto.
  const [o] = await ambiente.db.query<{ id: string }>(`select id from ordini where tipo='asporto'`)
  await rifiutaOrdine(ambiente.db,o.id,'Fascia piena')
  await crea()
})
it('ordini chiusi: interruttore spento, allergeni da confermare (salvo prova) e fascia troppo vicina', async () => {
  await impostaApertura(ambiente.db,null)
  expect(await invia()).toMatchObject({ ok: false,campo: 'tipo',errore: 'Ordini online chiusi in questo momento.' })
  await impostaApertura(ambiente.db,'2026-10-12')
  await ambiente.db.query('update piatti set allergeni_confermati=false where numero=2')
  expect(await invia()).toMatchObject({ ok: false,errore: expect.stringContaining('allergeni') })
  await crea({ prova: true })
  expect(await invia({ prova: true,dati: { ...asporto,fascia: new Date('2026-10-12T16:15:00.000Z') } })).toMatchObject({ ok: false,campo: 'fascia' })
})
it('limiti: tre ordini in attesa per telefono e dieci all’ora per rete', async () => {
  await ambiente.db.query('update impostazioni_casa set capacita_fascia=50,capacita_consegne=50')
  for (let i = 0; i < 3; i++) await crea()
  expect(await invia()).toMatchObject({ ok: false,campo: 'telefono' })
  for (let i = 0; i < 7; i++) await crea({ dati: { ...asporto,telefono: `33300000${i}0` } })
  expect(await invia({ dati: { ...asporto,telefono: '3339999999' } })).toMatchObject({ ok: false,errore: expect.stringContaining('connessione') })
  await crea({ dati: { ...asporto,telefono: '3339999999' },rete: '198.51.100.7' })
  await crea({ dati: { ...asporto,telefono: '3338888888' },rete: null })
})
it('poke composta da casa solo con gli allergeni degli ingredienti confermati', async () => {
  const { db } = ambiente
  const c = (await leggiPokeConfig(db))!; c.prezzoBaseCent = 900; c.prezzoExtraCent = 100; await salvaPokeConfig(db,c)
  const poke = Object.fromEntries(c.gruppi.map(g => [g.nome,g.voci.slice(0,g.min)]))
  const conPoke = { righe: [{ piattoId: null,quantita: 1,nota: '',poke }],totaleVistoCent: 900 }
  expect(await invia(conPoke)).toMatchObject({ ok: false,campo: 'carrello',errore: expect.stringContaining('poke composta') })
  await salvaAllergeniPoke(db,{ ...(await leggiAllergeniPoke(db,c)),confermati: true })
  expect(await crea(conPoke)).toMatchObject({ totaleCent: 900,righe: [{ nome: 'Poke composta' }] })
})
it('accettazione con ritardo, passaggi di stato e doppio tocco', async () => {
  const { db } = ambiente
  const o = await crea()
  expect(await accettaOrdine(db,o.id,15)).toMatchObject({ stato: 'accettato',fascia: F1845 })
  expect(await accettaOrdine(db,o.id,0)).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'in_attesa')).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'accettato')).toMatchObject({ stato: 'in_preparazione' })
  expect(await avanzaOrdineCasa(db,o.id,'accettato')).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'in_preparazione')).toMatchObject({ stato: 'pronto' })
  expect(await avanzaOrdineCasa(db,o.id,'pronto')).toMatchObject({ stato: 'completato' })
  expect(await annullaOrdineCasa(db,o.id)).toBeNull()
  const d = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  await accettaOrdine(db,d.id,0); await avanzaOrdineCasa(db,d.id,'accettato'); await avanzaOrdineCasa(db,d.id,'in_preparazione')
  expect(await avanzaOrdineCasa(db,d.id,'pronto')).toMatchObject({ stato: 'in_consegna' })
  expect(await annullaOrdineCasa(db,d.id)).toMatchObject({ stato: 'annullato' })
  expect((await db.query<{ tipo: string }>('select tipo from email_ordini where ordine_id=$1 order by creata_il,tipo',[d.id])).map(e => e.tipo).sort()).toEqual(['accettato','annullato','ricevuto'])
  expect(await accettaOrdine(db,o.id,20 as 15)).toBeNull()
})
it('rifiuto con motivo ed email; si rifiuta solo un ordine in attesa', async () => {
  const { db } = ambiente
  const o = await crea()
  expect(await annullaOrdineCasa(db,o.id)).toBeNull()
  expect(await rifiutaOrdine(db,o.id,'Zona non servita')).toMatchObject({ stato: 'rifiutato',motivoRifiuto: 'Zona non servita' })
  expect(await rifiutaOrdine(db,o.id,'Altro')).toBeNull()
  expect(await db.query(`select tipo from email_ordini where tipo='rifiutato'`)).toHaveLength(1)
})
it('annullare righe ricalcola con la consegna; senza righe l’ordine è annullato con email', async () => {
  const { db } = ambiente
  const d = await crea({ dati: domicilio(),righe: [{ piattoId: piatto,quantita: 3,nota: '' },{ piattoId: (await db.query<{ id: string }>('select id from piatti where numero=2'))[0].id,quantita: 1,nota: '' }],totaleVistoCent: 2000 + (await db.query<{ p: number }>('select prezzo_cent as p from piatti where numero=2'))[0].p })
  await accettaOrdine(db,d.id,0)
  expect(await annullaRiga(db,d.righe[1].id,UTENTE)).toBe('ok')
  expect((await ordiniCasaAttivi(db))[0]).toMatchObject({ totaleCent: 2000,stato: 'accettato' })
  expect(await annullaRiga(db,d.righe[0].id,UTENTE)).toBe('ok')
  expect(await ordiniCasaAttivi(db)).toEqual([])
  expect(await db.query(`select stato,totale_cent from ordini where id=$1`,[d.id])).toEqual([{ stato: 'annullato',totale_cent: 0 }])
  expect(await db.query(`select tipo from email_ordini where ordine_id=$1 and tipo='annullato'`,[d.id])).toHaveLength(1)
})
it('cucina: da casa in ordine di fascia, esclusi dalla lettura dei tavoli', async () => {
  const { db } = ambiente
  const tardi = await crea({ dati: { ...asporto,fascia: F1845 } })
  const presto = await crea()
  expect((await ordiniCasaAttivi(db)).map(o => o.id)).toEqual([presto.id,tardi.id])
  expect(await ordiniAttivi(db)).toEqual([])
})
it('anonimizzazione dopo 12 mesi, idempotente', async () => {
  const { db } = ambiente
  const vecchio = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  const recente = await crea()
  await db.query(`update ordini set creato_il='2025-10-01T10:00:00Z' where id=$1`,[vecchio.id])
  expect(await anonimizzaOrdiniCasa(db,ADESSO)).toBe(1)
  expect(await anonimizzaOrdiniCasa(db,ADESSO)).toBe(0)
  expect(await db.query(`select cliente_nome,cliente_telefono,cliente_email,indirizzo,note_consegna,rete,anonimizzato_il is not null as fatto,zona_nome,totale_cent from ordini where id=$1`,[vecchio.id]))
    .toEqual([{ cliente_nome: null,cliente_telefono: null,cliente_email: null,indirizzo: null,note_consegna: null,rete: null,fatto: true,zona_nome: 'Bitetto',totale_cent: 2000 }])
  expect(await db.query('select nota from righe_ordine where ordine_id=$1',[vecchio.id])).toEqual([{ nota: null }])
  expect(await db.query('select cliente_nome from ordini where id=$1',[recente.id])).toEqual([{ cliente_nome: 'Anna' }])
})
it('l’ordine riporta l’ora dell’ultimo cambio di stato, per la cronologia del cliente', async () => {
  const { db } = ambiente
  const o = await crea()
  await accettaOrdine(db,o.id,0)
  const letto = (await ordineCasaPerToken(db,o.token))!
  expect(letto.aggiornatoIl).toBeInstanceOf(Date)
  expect(letto.aggiornatoIl.getTime()).toBeGreaterThanOrEqual(new Date(letto.creatoIl).getTime())
})
