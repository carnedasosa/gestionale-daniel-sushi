import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { aggiungiChiusura, aggiungiOrario, allergeniCompleti, creaZona, elencoChiusure, elencoOrari, elencoZone, impostaApertura, leggiImpostazioni, rimuoviChiusura, rimuoviOrario, salvaImpostazioni, salvaZona, turniDelGiorno, zonaPerId } from './impostazioni-repo'
import { leggiDisponibilita } from './disponibilita'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest() })
afterEach(async () => { await ambiente.pg.close() })
// Lunedì 12/10/2026 alle 18:00 di Roma.
const ADESSO = new Date('2026-10-12T16:00:00Z')
async function prepara() {
  const { db } = ambiente
  await salvaImpostazioni(db,{ capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '19:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '19:00' })
  return creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
}
it('impostazioni, apertura del giorno e telefono', async () => {
  const { db } = ambiente
  await salvaImpostazioni(db,{ capacitaFascia: 6,capacitaConsegne: 3,anticipoMinuti: 45,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  expect(await leggiImpostazioni(db)).toEqual({ capacitaFascia: 6,capacitaConsegne: 3,anticipoMinuti: 45,telefono: '0801234567',apertiIl: '2026-10-12' })
  await impostaApertura(db,null)
  expect((await leggiImpostazioni(db)).apertiIl).toBeNull()
})
it('zone: creazione, modifica, disattivazione e id non validi', async () => {
  const { db } = ambiente
  const z = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 1 })
  await creaZona(db,{ nome: 'Palo del Colle',costoCent: 300,minimoCent: 2000,attiva: true,posizione: 0 })
  expect((await elencoZone(db)).map(z => z.nome)).toEqual(['Palo del Colle','Bitetto'])
  expect(await salvaZona(db,z.id,{ nome: 'Bitetto centro',costoCent: 0,minimoCent: 1000,attiva: false,posizione: 1 })).toBe(true)
  expect(await zonaPerId(db,z.id)).toEqual({ id: z.id,nome: 'Bitetto centro',costoCent: 0,minimoCent: 1000,attiva: false,posizione: 1 })
  expect((await elencoZone(db,true)).map(z => z.nome)).toEqual(['Palo del Colle'])
  expect(await salvaZona(db,'x',{ nome: 'X',costoCent: 0,minimoCent: 0,attiva: true,posizione: 0 })).toBe(false)
  expect(await zonaPerId(db,'x')).toBeNull()
})
it('orari e chiusure', async () => {
  const { db } = ambiente
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '19:00',alle: '23:00' })
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '12:00',alle: '14:30' })
  expect(await turniDelGiorno(db,'asporto',1)).toEqual([{ dalle: '12:00',alle: '14:30' },{ dalle: '19:00',alle: '23:00' }])
  expect(await turniDelGiorno(db,'domicilio',1)).toEqual([])
  const [primo] = await elencoOrari(db)
  expect(await rimuoviOrario(db,primo.id)).toBe(true)
  expect(await rimuoviOrario(db,primo.id)).toBe(false)
  await aggiungiChiusura(db,'2026-10-11','Ieri')
  await aggiungiChiusura(db,'2026-12-25',null)
  await aggiungiChiusura(db,'2026-12-25','Natale')
  expect(await elencoChiusure(db,'2026-10-12')).toEqual([{ data: '2026-12-25',motivo: 'Natale' }])
  expect(await rimuoviChiusura(db,'2026-12-25')).toBe(true)
})
it('allergeni completi solo se tutti i piatti disponibili sono confermati', async () => {
  const { db } = ambiente
  await db.query(`insert into categorie (id,nome,posizione) values ('c','C',1)`)
  await db.query(`insert into piatti (categoria_id,nome,prezzo_cent,posizione,allergeni_confermati,disponibile) values ('c','A',100,1,true,true),('c','B',100,2,false,false)`)
  expect(await allergeniCompleti(db)).toBe(true)
  await db.query(`update piatti set disponibile=true where nome='B'`)
  expect(await allergeniCompleti(db)).toBe(false)
})
it('disponibilità: fasce di oggi per servizio, con capacità e consegne occupate', async () => {
  const { db } = ambiente
  await prepara()
  const d = await leggiDisponibilita(db,ADESSO,true)
  expect(d.oggi).toBe('2026-10-12')
  expect(d.servizi.asporto).toEqual({ apertura: { aperto: true },fasce: ['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'],piene: [] })
  expect(d.servizi.domicilio).toEqual({ apertura: { aperto: true },fasce: ['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'],piene: [] })
  await db.query(`insert into ordini (tipo,stato,totale_cent,token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_nome,consegna_cent,indirizzo,pagamento,privacy_il)
    values ('domicilio','in_attesa',1700,$1,'2026-10-12T16:30:00Z','A','3331234567','a@b.it','Bitetto',200,'Via Roma 1','carta',now()),
           ('asporto','rifiutato',1700,$2,'2026-10-12T16:45:00Z','A','3331234567','a@b.it',null,0,null,'carta',now())`,['A'.repeat(32),'B'.repeat(32)])
  const dopo = await leggiDisponibilita(db,ADESSO,true)
  expect(dopo.servizi.asporto.fasce).toEqual(['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'])
  expect(dopo.servizi.domicilio.fasce).toEqual(['2026-10-12T16:45:00.000Z'])
  expect(dopo.servizi.domicilio.piene).toEqual(['2026-10-12T16:30:00.000Z']); expect(dopo.servizi.asporto.piene).toEqual([])
})
it('disponibilità: allergeni, interruttore di ieri e giorno di chiusura', async () => {
  const { db } = ambiente
  await prepara()
  await db.query(`insert into categorie (id,nome,posizione) values ('c','C',1)`)
  await db.query(`insert into piatti (categoria_id,nome,prezzo_cent,posizione) values ('c','A',100,1)`)
  expect((await leggiDisponibilita(db,ADESSO,false)).servizi.asporto).toEqual({ apertura: { aperto: false,motivo: 'allergeni' },fasce: [],piene: [] })
  await impostaApertura(db,'2026-10-11')
  expect((await leggiDisponibilita(db,ADESSO,true)).servizi.asporto.apertura).toEqual({ aperto: false,motivo: 'spenti' })
  await impostaApertura(db,'2026-10-12'); await aggiungiChiusura(db,'2026-10-12',null)
  expect((await leggiDisponibilita(db,ADESSO,true)).servizi.domicilio.apertura).toEqual({ aperto: false,motivo: 'chiusura' })
})
