import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'

const file = '20261016120000_origine_ordini.sql'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessioneId: string, contatore = 0
function ordineCasa(diverso: Record<string,unknown> = {}) {
  const token = `abcdefghijklmnopqrstuvwxyz${String(contatore++).padStart(6,'0')}`
  const campi: Record<string,unknown> = { tipo: 'asporto',stato: 'in_attesa',totale_cent: 1000,token,fascia: '2026-10-12T17:15:00Z',cliente_nome: 'Anna',cliente_telefono: '3331234567',
    cliente_email: 'anna@esempio.it',consegna_cent: 0,pagamento: 'carta',privacy_il: '2026-10-12T16:00:00Z',...diverso }
  for (const [k,v] of Object.entries(campi)) if (v === undefined) delete campi[k]
  const nomi = Object.keys(campi)
  return ambiente.db.query<{ id: string }>(`insert into ordini (${nomi.join(',')}) values (${nomi.map((_,i) => `$${i + 1}`).join(',')}) returning id`,Object.values(campi))
}
async function sessione() {
  const [t] = await ambiente.db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
  const [s] = await ambiente.db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
  return s.id
}
beforeEach(async () => {
  ambiente = await creaDbDiTest({ primaDi: file })
  sessioneId = await sessione()
  await ambiente.db.query('insert into ordini (sessione_id,totale_cent) values ($1,600)',[sessioneId])
  await ordineCasa()
  await ambiente.pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
})
afterEach(async () => { await ambiente.pg.close() })
it('gli ordini esistenti, tavolo e casa, vengono dal cliente', async () => {
  expect(await ambiente.db.query('select origine from ordini order by tipo')).toEqual([{ origine: 'cliente' },{ origine: 'cliente' }])
  await expect(ordineCasa({ origine: 'telefono' })).rejects.toThrow(/check/)
})
it('dalla cassa: senza email né privacy, mai in attesa', async () => {
  await ordineCasa({ origine: 'cassa',stato: 'accettato',cliente_email: undefined,privacy_il: undefined })
  await ordineCasa({ origine: 'cassa',stato: 'accettato',tipo: 'domicilio',zona_nome: 'Bitetto',indirizzo: 'Via Roma 1',consegna_cent: 200,cliente_email: undefined,privacy_il: undefined })
  await expect(ordineCasa({ origine: 'cassa',stato: 'in_attesa',cliente_email: undefined,privacy_il: undefined })).rejects.toThrow(/ordini_casa_check/)
  await expect(ordineCasa({ origine: 'cassa',stato: 'accettato',cliente_nome: undefined,privacy_il: undefined })).rejects.toThrow(/ordini_casa_check/)
  await expect(ordineCasa({ origine: 'cassa',stato: 'accettato',cliente_telefono: undefined,privacy_il: undefined })).rejects.toThrow(/ordini_casa_check/)
})
it('dal cliente restano obbligatori email e privacy', async () => {
  await expect(ordineCasa({ cliente_email: undefined })).rejects.toThrow(/ordini_casa_check/)
  await expect(ordineCasa({ privacy_il: undefined })).rejects.toThrow(/ordini_casa_check/)
  await ordineCasa({ cliente_email: undefined,cliente_nome: undefined,cliente_telefono: undefined,anonimizzato_il: '2027-10-12T03:00:00Z' })
})
it('la cassa non ordina ai tavoli e il cameriere non ordina da casa', async () => {
  await expect(ambiente.db.query("insert into ordini (sessione_id,totale_cent,origine) values ($1,600,'cassa')",[sessioneId])).rejects.toThrow(/ordini_tavolo_check/)
  await ambiente.db.query("insert into ordini (sessione_id,totale_cent,origine) values ($1,600,'cameriere')",[sessioneId])
  await expect(ordineCasa({ origine: 'cameriere' })).rejects.toThrow(/ordini_casa_check/)
})
