import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'
import { apriSessione, chiudiSessione, creaTavolo } from '@/tavoli/repo'
import { annullaOrdine, annullaRiga, annullaVoceConto, avanzaStato, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { accettaOrdine, annullaOrdineCasa, avanzaOrdineCasa, rifiutaOrdine } from '@/casa/ordini-casa-repo'
import { avanzaComanda, comandeAttive, daPortare, portaComanda, riepilogoComande } from './comande-repo'
const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatti: Record<string,string>
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 1','tavolo-1')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  const p = await ambiente.db.query<{ id: string; categoria_id: string }>(`select distinct on (categoria_id) id,categoria_id from piatti where categoria_id in ('tartare','dessert','beverage') order by categoria_id,posizione`)
  piatti = Object.fromEntries(p.map(x => [x.categoria_id,x.id]))
})
afterEach(async () => { await ambiente.pg.close() })
async function ordineMisto(categorie = ['tartare','dessert','beverage']) {
  const e = await creaOrdineTavolo(ambiente.db,sessione,categorie.map(c => ({ piattoId: piatti[c],quantita: 1,nota: '' })),randomUUID())
  if (!e.ok) throw new Error(e.errore)
  return e.ordine
}
const comande = async (ordineId: string) => Object.fromEntries((await ambiente.db.query<{ reparto: string; stato: string }>('select reparto,stato from comande where ordine_id=$1',[ordineId])).map(c => [c.reparto,c.stato]))
const idComanda = async (ordineId: string, reparto: string) => (await ambiente.db.query<{ id: string }>('select id from comande where ordine_id=$1 and reparto=$2',[ordineId,reparto]))[0].id
const statoOrdine = async (id: string) => (await ambiente.db.query<{ stato: string }>('select stato from ordini where id=$1',[id]))[0].stato

it('tartare, dolce e bibita: tre comande, da preparare', async () => {
  const o = await ordineMisto()
  expect(await comande(o.id)).toEqual({ banco: 'da_preparare',cucina: 'da_preparare',sala: 'da_preparare' })
  expect((await riepilogoComande(ambiente.db,[o.id])).get(o.id)!.map(c => c.reparto)).toEqual(['banco','cucina','sala'])
})
it('ogni reparto avanza la sua parte; l’ordine è servito quando tutte sono pronte', async () => {
  const o = await ordineMisto()
  const banco = await idComanda(o.id,'banco'), cucina = await idComanda(o.id,'cucina'), sala = await idComanda(o.id,'sala')
  expect(await avanzaComanda(ambiente.db,banco,'da_preparare')).toBe(true)
  expect(await statoOrdine(o.id)).toBe('in_preparazione')
  // Doppio tocco: lo stato visto non è più quello attuale.
  expect(await avanzaComanda(ambiente.db,banco,'da_preparare')).toBeNull()
  expect(await avanzaComanda(ambiente.db,banco,'in_preparazione')).toBe(true)
  expect(await avanzaComanda(ambiente.db,banco,'pronta')).toBeNull()
  expect(await statoOrdine(o.id)).toBe('in_preparazione')
  await avanzaComanda(ambiente.db,cucina,'da_preparare'); await avanzaComanda(ambiente.db,cucina,'in_preparazione')
  expect(await statoOrdine(o.id)).toBe('in_preparazione')
  // Le bibite non passano dal reparto: le porta la sala.
  expect(await avanzaComanda(ambiente.db,sala,'da_preparare')).toBe(true)
  expect(await statoOrdine(o.id)).toBe('servito')
  expect(await comande(o.id)).toEqual({ banco: 'pronta',cucina: 'pronta',sala: 'pronta' })
  // A ordine servito le comande non si toccano più.
  await ambiente.db.query(`update comande set stato='in_preparazione' where id=$1`,[banco])
  expect(await avanzaComanda(ambiente.db,banco,'in_preparazione')).toBeNull()
})
it('comandeAttive: solo il proprio reparto, con il conto delle righe degli altri; niente ordini da accettare', async () => {
  const o = await ordineMisto()
  const { piatto } = await preparaCasa(ambiente.db)
  const casa = await ordineAsporto(ambiente.db,piatto)
  const banco = await comandeAttive(ambiente.db,'banco')
  expect(banco.map(c => c.ordineId)).toEqual([o.id])
  expect(banco[0]).toMatchObject({ reparto: 'banco',stato: 'da_preparare',tipo: 'tavolo',tavoloNome: 'Tavolo 1',tavoloChiuso: false,numero: o.numero })
  expect(banco[0].righe.map(r => r.reparto)).toEqual(['banco'])
  expect(banco[0].altreRighe).toEqual([{ reparto: 'cucina',n: 1 },{ reparto: 'sala',n: 1 }])
  expect((await comandeAttive(ambiente.db,'cucina')).map(c => c.righe.map(r => r.reparto))).toEqual([['cucina']])
  await accettaOrdine(ambiente.db,casa.id,0)
  expect((await comandeAttive(ambiente.db,'banco')).map(c => c.tipo)).toContain('asporto')
})
it('da casa: le comande portano l’ordine fino a pronto, poi la cassa lo consegna', async () => {
  const { piatto } = await preparaCasa(ambiente.db)
  const casa = await ordineAsporto(ambiente.db,piatto)
  const banco = await idComanda(casa.id,'banco')
  // In attesa: il reparto non la vede e non la può avanzare.
  expect(await avanzaComanda(ambiente.db,banco,'da_preparare')).toBeNull()
  await accettaOrdine(ambiente.db,casa.id,0)
  await avanzaComanda(ambiente.db,banco,'da_preparare')
  expect(await statoOrdine(casa.id)).toBe('in_preparazione')
  await avanzaComanda(ambiente.db,banco,'in_preparazione')
  expect(await statoOrdine(casa.id)).toBe('pronto')
  expect(await comandeAttive(ambiente.db,'banco')).toEqual([])
  expect(await avanzaOrdineCasa(ambiente.db,casa.id,'pronto')).not.toBeNull()
  expect(await statoOrdine(casa.id)).toBe('completato')
})
it('bottoni a cascata della cassa: tutte le comande insieme, servito vuol dire anche portato', async () => {
  const o = await ordineMisto()
  await avanzaStato(ambiente.db,o.id,'inviato')
  expect(await comande(o.id)).toEqual({ banco: 'in_preparazione',cucina: 'in_preparazione',sala: 'in_preparazione' })
  await avanzaStato(ambiente.db,o.id,'in_preparazione')
  expect(await comande(o.id)).toEqual({ banco: 'pronta',cucina: 'pronta',sala: 'pronta' })
  expect(await daPortare(ambiente.db)).toEqual([])
  const { piatto } = await preparaCasa(ambiente.db)
  const casa = await ordineAsporto(ambiente.db,piatto)
  await accettaOrdine(ambiente.db,casa.id,0)
  await avanzaOrdineCasa(ambiente.db,casa.id,'accettato'); await avanzaOrdineCasa(ambiente.db,casa.id,'in_preparazione')
  expect(await comande(casa.id)).toEqual({ banco: 'pronta' })
})
it('annullare la sola riga della cucina con il banco pronto: comanda annullata, ordine servito', async () => {
  const o = await ordineMisto(['tartare','dessert'])
  const banco = await idComanda(o.id,'banco')
  await avanzaComanda(ambiente.db,banco,'da_preparare'); await avanzaComanda(ambiente.db,banco,'in_preparazione')
  expect(await statoOrdine(o.id)).toBe('in_preparazione')
  expect(await annullaRiga(ambiente.db,o.righe.find(r => r.reparto === 'cucina')!.id,UTENTE)).toBe('ok')
  expect(await comande(o.id)).toEqual({ banco: 'pronta',cucina: 'annullata' })
  expect(await statoOrdine(o.id)).toBe('servito')
})
it('voce tolta dal conto e ordine annullato: comande annullate', async () => {
  const o = await ordineMisto(['tartare','beverage'])
  const bibita = o.righe.find(r => r.reparto === 'sala')!
  expect(await annullaVoceConto(ambiente.db,sessione,{ nome: bibita.nome,numero: bibita.numero,prezzoUnitCent: bibita.prezzoUnitCent,poke: null },UTENTE)).toBe('ok')
  expect(await comande(o.id)).toEqual({ banco: 'da_preparare',sala: 'annullata' })
  expect(await annullaOrdine(ambiente.db,o.id,UTENTE)).toBe('ok')
  expect(await comande(o.id)).toEqual({ banco: 'annullata',sala: 'annullata' })
})
it('ordini da casa rifiutati o annullati: comande annullate', async () => {
  const { piatto } = await preparaCasa(ambiente.db)
  const a = await ordineAsporto(ambiente.db,piatto), b = await ordineAsporto(ambiente.db,piatto)
  await rifiutaOrdine(ambiente.db,a.id,'Fascia piena')
  await accettaOrdine(ambiente.db,b.id,0); await annullaOrdineCasa(ambiente.db,b.id)
  expect(await comande(a.id)).toEqual({ banco: 'annullata' })
  expect(await comande(b.id)).toEqual({ banco: 'annullata' })
})
it('da portare: bibite da servire e piatti pronti; «Portate» li toglie dalla striscia', async () => {
  const o = await ordineMisto()
  expect((await daPortare(ambiente.db)).map(v => [v.reparto,v.tavoloNome,v.righe.length])).toEqual([['sala','Tavolo 1',1]])
  const banco = await idComanda(o.id,'banco'), sala = await idComanda(o.id,'sala'), cucina = await idComanda(o.id,'cucina')
  // Un piatto non ancora pronto non si porta.
  expect(await portaComanda(ambiente.db,banco)).toBeNull()
  await avanzaComanda(ambiente.db,banco,'da_preparare'); await avanzaComanda(ambiente.db,banco,'in_preparazione')
  expect((await daPortare(ambiente.db)).map(v => v.reparto).sort()).toEqual(['banco','sala'])
  expect(await portaComanda(ambiente.db,sala)).toBe(true)
  expect(await portaComanda(ambiente.db,sala)).toBeNull()
  expect(await portaComanda(ambiente.db,banco)).toBe(true)
  expect(await portaComanda(ambiente.db,banco)).toBeNull()
  expect(await daPortare(ambiente.db)).toEqual([])
  expect(await statoOrdine(o.id)).toBe('in_preparazione')
  await avanzaComanda(ambiente.db,cucina,'da_preparare'); await avanzaComanda(ambiente.db,cucina,'in_preparazione')
  expect(await statoOrdine(o.id)).toBe('servito')
  // Il servito resta da portare finché la sala non lo porta, o finché il tavolo è aperto.
  expect((await daPortare(ambiente.db)).map(v => v.reparto)).toEqual(['cucina'])
  expect(await chiudiSessione(ambiente.db,sessione,null)).toEqual({ ok: true })
  expect(await daPortare(ambiente.db)).toEqual([])
})
it('da casa niente striscia e niente «Portate»', async () => {
  const { piatto } = await preparaCasa(ambiente.db)
  const casa = await ordineAsporto(ambiente.db,piatto)
  await accettaOrdine(ambiente.db,casa.id,0)
  expect(await portaComanda(ambiente.db,await idComanda(casa.id,'banco'))).toBeNull()
  expect(await daPortare(ambiente.db)).toEqual([])
  expect(await avanzaComanda(ambiente.db,'non-un-id','da_preparare')).toBeNull()
})
