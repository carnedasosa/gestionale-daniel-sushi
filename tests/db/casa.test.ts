import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
afterEach(async () => { await ambiente.pg.close() })
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'
// Un ordine da casa valido: ogni test cambia solo le colonne che gli interessano.
function ordineCasa(diverso: Record<string,unknown> = {}) {
  const campi = { tipo: 'asporto',stato: 'in_attesa',totale_cent: 1000,token: TOKEN,fascia: '2026-10-12T17:15:00Z',cliente_nome: 'Anna',cliente_telefono: '3331234567',
    cliente_email: 'anna@esempio.it',consegna_cent: 0,pagamento: 'carta',privacy_il: '2026-10-12T16:00:00Z',...diverso }
  const nomi = Object.keys(campi)
  return ambiente.db.query(`insert into ordini (${nomi.join(',')}) values (${nomi.map((_,i) => `$${i + 1}`).join(',')}) returning id`,Object.values(campi))
}
describe('migrazione con dati esistenti', () => {
  it('gli ordini dei tavoli già presenti restano validi', async () => {
    ambiente = await creaDbDiTest({ primaDi: '20261013120000' })
    const { db,pg } = ambiente
    const [t] = await db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
    const [s] = await db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
    await db.query(`insert into ordini (sessione_id,totale_cent,stato) values ($1,600,'servito'),($1,0,'annullato')`,[s.id])
    await pg.exec(readFileSync('supabase/migrations/20261013120000_domicilio_asporto.sql','utf8'))
    expect(await db.query(`select tipo,stato from ordini order by stato`)).toEqual([{ tipo: 'tavolo',stato: 'annullato' },{ tipo: 'tavolo',stato: 'servito' }])
    await expect(db.query(`insert into ordini (sessione_id,totale_cent,stato) values ($1,600,'in_attesa')`,[s.id])).rejects.toThrow(/ordini_stato_check/)
    await expect(db.query(`insert into ordini (sessione_id,totale_cent,token) values ($1,600,$2)`,[s.id,TOKEN])).rejects.toThrow(/ordini_tavolo_check/)
  })
})
describe('schema degli ordini da casa', () => {
  beforeEach(async () => { ambiente = await creaDbDiTest() })
  it('impostazioni create con i valori di default e una sola riga', async () => {
    expect(await ambiente.db.query('select capacita_fascia,capacita_consegne,anticipo_minuti,telefono,aperti_il from impostazioni_casa'))
      .toEqual([{ capacita_fascia: 4,capacita_consegne: 2,anticipo_minuti: 30,telefono: null,aperti_il: null }])
    await expect(ambiente.db.query('insert into impostazioni_casa (id) values (2)')).rejects.toThrow()
    await expect(ambiente.db.query('update impostazioni_casa set capacita_consegne=5')).rejects.toThrow()
    await expect(ambiente.db.query(`update impostazioni_casa set telefono='080-123'`)).rejects.toThrow()
  })
  it('asporto valido; stato, token e dati del cliente controllati', async () => {
    await ordineCasa()
    await expect(ordineCasa({ token: 'corto' })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: TOKEN })).rejects.toThrow(/ordini_token_unico/)
    await expect(ordineCasa({ token: 'B'.repeat(32),stato: 'in_consegna' })).rejects.toThrow(/ordini_stato_check/)
    await expect(ordineCasa({ token: 'C'.repeat(32),cliente_email: null })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'D'.repeat(32),consegna_cent: 200 })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'E'.repeat(32),pagamento: 'carta',contanti_da_cent: 5000 })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'F'.repeat(32),privacy_il: null })).rejects.toThrow(/ordini_casa_check/)
  })
  it('domicilio: zona e indirizzo obbligatori, salvo dopo l’anonimizzazione', async () => {
    const dom = { tipo: 'domicilio',zona_nome: 'Bitetto',consegna_cent: 200,indirizzo: 'Via Roma 1' }
    await ordineCasa({ ...dom,stato: 'in_consegna' })
    await expect(ordineCasa({ ...dom,token: 'B'.repeat(32),indirizzo: null })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ ...dom,token: 'C'.repeat(32),zona_nome: null })).rejects.toThrow(/ordini_casa_check/)
    await ordineCasa({ ...dom,token: 'D'.repeat(32),indirizzo: null,cliente_nome: null,cliente_telefono: null,cliente_email: null,anonimizzato_il: '2027-10-13T00:00:00Z' })
  })
  it('una sola email per tipo e per ordine, cancellata con l’ordine', async () => {
    const [o] = await ordineCasa()
    await ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[o.id])
    await expect(ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[o.id])).rejects.toThrow()
    await expect(ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'pronto')`,[o.id])).rejects.toThrow()
    await ambiente.db.query('delete from ordini where id=$1',[o.id])
    expect(await ambiente.db.query('select * from email_ordini')).toEqual([])
  })
  it('orari con inizio prima della fine e poke con allergeni vuoti di default', async () => {
    await ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',1,'19:00','23:00')`)
    await expect(ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',1,'23:00','19:00')`)).rejects.toThrow()
    await expect(ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',8,'19:00','23:00')`)).rejects.toThrow()
    await ambiente.db.query(`insert into poke_config (titolo,gruppi) values ('Poke','[]')`)
    expect(await ambiente.db.query('select allergeni_voci,allergeni_confermati from poke_config')).toEqual([{ allergeni_voci: {},allergeni_confermati: false }])
  })
  it('nessun accesso via API alle nuove tabelle', async () => {
    const tabelle = ['zone_consegna','orari_casa','chiusure_casa','impostazioni_casa','email_ordini']
    const righe = await ambiente.db.query<{ t: string; rls: boolean; anon: boolean; auth: boolean }>(`select c.relname as t,c.relrowsecurity as rls,
      has_table_privilege('anon',c.oid,'select') as anon,has_table_privilege('authenticated',c.oid,'select') as auth
      from pg_class c where c.relname = any($1::text[]) order by c.relname`,[tabelle])
    expect(righe).toEqual(tabelle.sort().map(t => ({ t,rls: true,anon: false,auth: false })))
  })
})
