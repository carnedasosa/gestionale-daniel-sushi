import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest() })
afterEach(async () => { await ambiente.pg.close() })
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'
// In SQL un check che vale NULL passa: i campi obbligatori vanno rifiutati anche quando mancano.
function ordineCasa(diverso: Record<string,unknown> = {}) {
  const campi: Record<string,unknown> = { tipo: 'asporto',stato: 'in_attesa',totale_cent: 1000,token: TOKEN,fascia: '2026-10-12T17:15:00Z',cliente_nome: 'Anna',cliente_telefono: '3331234567',
    cliente_email: 'anna@esempio.it',consegna_cent: 0,pagamento: 'carta',privacy_il: '2026-10-12T16:00:00Z',...diverso }
  for (const [k,v] of Object.entries(campi)) if (v === undefined) delete campi[k]
  const nomi = Object.keys(campi)
  return ambiente.db.query(`insert into ordini (${nomi.join(',')}) values (${nomi.map((_,i) => `$${i + 1}`).join(',')}) returning id`,Object.values(campi))
}
async function sessione() {
  const [t] = await ambiente.db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
  const [s] = await ambiente.db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
  return s.id
}
describe('vincoli completi degli ordini da casa', () => {
  it('rifiuta un ordine da casa senza token, consegna o pagamento', async () => {
    await expect(ordineCasa({ token: undefined })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ consegna_cent: undefined })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ pagamento: undefined })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ tipo: 'domicilio',zona_nome: 'Bitetto',indirizzo: 'Via Roma 1',consegna_cent: undefined })).rejects.toThrow(/ordini_casa_check/)
    await ordineCasa()
  })
  it('un ordine del tavolo non ha nessuna colonna della casa', async () => {
    const s = await sessione()
    for (const [colonna,valore] of Object.entries({ cliente_telefono: '3331234567',cliente_email: 'a@b.it',zona_nome: 'Bitetto',indirizzo: 'Via Roma 1',note_consegna: 'citofono',
      contanti_da_cent: 5000,privacy_il: '2026-10-12T16:00:00Z',motivo_rifiuto: 'no',rete: 'abc',anonimizzato_il: '2026-10-12T16:00:00Z' }))
      await expect(ambiente.db.query(`insert into ordini (sessione_id,totale_cent,${colonna}) values ($1,600,$2)`,[s,valore]),colonna).rejects.toThrow(/ordini_tavolo_check/)
    await ambiente.db.query(`insert into ordini (sessione_id,totale_cent) values ($1,600)`,[s])
  })
})
