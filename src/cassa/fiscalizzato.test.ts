import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, creaTavolo, impostaCoperti } from '@/tavoli/repo'
import { annullaOrdine, annullaRiga, annullaVoceConto, contoSessione, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { accettaOrdine, annullaOrdineCasa, ordineCasaPerToken, rifiutaOrdine } from '@/casa/ordini-casa-repo'
import { chiaveVoce } from '@/domain/divisione-conto'
import { salvaImpostazioniCassa } from './impostazioni-repo'
import { registraPagamento, statoPagamenti, type Destinazione, type RichiestaPagamento } from './pagamenti-repo'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'

// Il piatto n. 1 del seed costa 6,00 €.
const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, p1: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 5','tavolo-5')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  ;[{ id: p1 }] = await ambiente.db.query<{ id: string }>('select id from piatti where numero=1')
})
afterEach(async () => { await ambiente.pg.close() })
const ordina = async (quantita: number[]) => {
  const e = await creaOrdineTavolo(ambiente.db,sessione,quantita.map(q => ({ piattoId: p1,quantita: q,nota: '' })),randomUUID()); if (!e.ok) throw new Error(e.errore); return e.ordine
}
/** Incassa e porta lo scontrino del pagamento nello stato voluto, come farebbero la richiesta e l'esito del ponte. */
const incassa = async (d: Destinazione, r: RichiestaPagamento, scontrino: string) => {
  const e = await registraPagamento(ambiente.db,d,r,'carta',UTENTE,randomUUID()); if (!e.ok) throw new Error(e.errore)
  await ambiente.db.query('update pagamenti set scontrino=$2 where id=$1',[e.pagamento.id,scontrino])
  return e.pagamento
}
const quante = async (tabella: 'registro_annullamenti' | 'stampe') => (await ambiente.db.query(`select id from ${tabella}`)).length

it('conto saldato con scontrino emesso: nessun annullo passa, e niente cambia', async () => {
  const { db } = ambiente
  const o = await ordina([2,1])
  await incassa({ sessioneId: sessione },{ modo: 'tutto' },'emesso')
  const prima = (await contoSessione(db,sessione))!
  const stampePrima = await quante('stampe')
  expect(await annullaRiga(db,o.righe[0].id,UTENTE)).toBe('scontrino_emesso')
  expect(await annullaOrdine(db,o.id,UTENTE)).toBe('scontrino_emesso')
  expect(await annullaVoceConto(db,sessione,prima.voci[0],UTENTE)).toBe('scontrino_emesso')
  const dopo = (await contoSessione(db,sessione))!
  expect(dopo.totaleCent).toBe(prima.totaleCent)
  expect(dopo.voci).toEqual(prima.voci)
  expect(await quante('registro_annullamenti')).toBe(0)
  expect(await quante('stampe')).toBe(stampePrima)
  expect(await statoPagamenti(db,{ sessioneId: sessione })).toMatchObject({ residuoCent: 0 })
})
it('scontrino su una parte del conto: si annulla finché il conto resta sopra l’importo battuto', async () => {
  const { db } = ambiente
  const a = await ordina([1]), b = await ordina([1]), c = await ordina([1])
  const chiave = chiaveVoce((await contoSessione(db,sessione))!.voci[0])
  await incassa({ sessioneId: sessione },{ modo: 'piatti',porzioni: [{ chiave,quantita: 2 }],coperti: 0 },'emesso')
  // 18 € di conto, 12 € battuti: una porzione si può ancora togliere, la seconda no.
  expect(await annullaRiga(db,a.righe[0].id,UTENTE)).toBe('ok')
  expect(await annullaRiga(db,b.righe[0].id,UTENTE)).toBe('scontrino_emesso')
  expect(await annullaOrdine(db,c.id,UTENTE)).toBe('scontrino_emesso')
  expect(await statoPagamenti(db,{ sessioneId: sessione })).toMatchObject({ totaleCent: 1200,pagatoCent: 1200,residuoCent: 0 })
  expect(await quante('registro_annullamenti')).toBe(1)
})
it('contano gli scontrini in coda e incerti, non quelli mai chiesti, in errore o di prova', async () => {
  const { db } = ambiente
  for (const [scontrino,esito] of [['in_coda','scontrino_emesso'],['incerto','scontrino_emesso'],['non_richiesto','ok'],['errore','ok'],['prova','ok']] as const) {
    const t = await creaTavolo(db,`Tavolo ${scontrino}`,`tavolo-${scontrino.replace('_','-')}`)
    sessione = (await apriSessione(db,t.id)).id
    const o = await ordina([1])
    await incassa({ sessioneId: sessione },{ modo: 'tutto' },scontrino)
    expect(await annullaRiga(db,o.righe[0].id,UTENTE),scontrino).toBe(esito)
  }
})
it('un pagamento tolto non conta più', async () => {
  const { db } = ambiente
  const o = await ordina([1])
  const p = await incassa({ sessioneId: sessione },{ modo: 'tutto' },'emesso')
  // Dal gestionale un pagamento con scontrino emesso non si toglie: qui lo stato si forza per provare il conteggio.
  await db.query('update pagamenti set annullato_il=now(),annullato_da=$2 where id=$1',[p.id,UTENTE])
  expect(await annullaRiga(db,o.righe[0].id,UTENTE)).toBe('ok')
})
it('coperti: non si tolgono se il conto scenderebbe sotto lo scontrino; aggiungerli si può', async () => {
  const { db } = ambiente
  await salvaImpostazioniCassa(db,{ copertoCent: 150,stampa: { banco: false,cucina: false,sala: false } })
  await ordina([1])
  expect(await impostaCoperti(db,sessione,2)).toBe('ok')
  await incassa({ sessioneId: sessione },{ modo: 'tutto' },'emesso')
  expect(await impostaCoperti(db,sessione,1)).toBe('scontrino_emesso')
  expect(await impostaCoperti(db,sessione,null)).toBe('scontrino_emesso')
  expect((await contoSessione(db,sessione))!).toMatchObject({ coperti: 2,totaleCent: 900 })
  expect(await impostaCoperti(db,sessione,3)).toBe('ok')
})
it('ordine da casa con scontrino emesso: né la riga né l’ordine si annullano, e non parte l’email', async () => {
  const { db } = ambiente
  const { piatto } = await preparaCasa(db)
  const o = await ordineAsporto(db,piatto)
  await accettaOrdine(db,o.id,0)
  await incassa({ ordineId: o.id },{ modo: 'tutto' },'emesso')
  expect(await annullaRiga(db,o.righe[0].id,UTENTE)).toBe('scontrino_emesso')
  expect(await annullaOrdineCasa(db,o.id)).toBe('scontrino_emesso')
  expect(await ordineCasaPerToken(db,o.token)).toMatchObject({ stato: 'accettato',totaleCent: 1200 })
  expect(await db.query(`select id from email_ordini where ordine_id=$1 and tipo='annullato'`,[o.id])).toEqual([])
  expect(await quante('registro_annullamenti')).toBe(0)
})
it('ordine da casa in attesa già battuto: non si rifiuta', async () => {
  const { db } = ambiente
  const { piatto } = await preparaCasa(db)
  const o = await ordineAsporto(db,piatto)
  await incassa({ ordineId: o.id },{ modo: 'tutto' },'emesso')
  expect(await rifiutaOrdine(db,o.id,'Fascia piena')).toBe('scontrino_emesso')
  expect(await ordineCasaPerToken(db,o.token)).toMatchObject({ stato: 'in_attesa' })
})
