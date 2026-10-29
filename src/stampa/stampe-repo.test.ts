import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, chiudiSessione, creaTavolo } from '@/tavoli/repo'
import { annullaOrdine, annullaRiga, annullaVoceConto, contoSessione, creaOrdineTavolo, ordiniDellaSessione } from '@/tavoli/ordini-repo'
import { accettaOrdine, annullaOrdineCasa, creaOrdineCasa } from '@/casa/ordini-casa-repo'
import { daPortare, portaComanda } from '@/comande/comande-repo'
import { salvaImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { prendiLavori, registraEsito, riprovaLavoro, ristampaOrdine, statoCoda, lavoriInErrore } from './stampe-repo'
import { testoSemplice } from './escpos'
import type { DocumentoStampa } from './documento'
import { ADESSO, ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'

const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatti: Record<'banco' | 'cucina' | 'sala',string>
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 5','tavolo-5')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  const id = async (categoria: string) => (await ambiente.db.query<{ id: string }>('select id from piatti where categoria_id=$1 order by posizione limit 1',[categoria]))[0].id
  piatti = { banco: await id('tartare'),cucina: await id('starter'),sala: await id('beverage') }
})
afterEach(async () => { await ambiente.pg.close() })
const carta = (db: Db, s: Partial<Record<'banco' | 'cucina' | 'sala',boolean>> = { banco: true,cucina: true }) =>
  salvaImpostazioniCassa(db,{ copertoCent: 0,stampa: { banco: false,cucina: false,sala: false,...s } })
const ordina = async (q: Partial<Record<'banco' | 'cucina' | 'sala',number>>) => {
  const righe = Object.entries(q).map(([r,quantita]) => ({ piattoId: piatti[r as 'banco'],quantita: quantita!,nota: '' }))
  const e = await creaOrdineTavolo(ambiente.db,sessione,righe,randomUUID()); if (!e.ok) throw new Error(e.errore); return e.ordine
}
const lavori = (db: Db) => db.query<{ id: string; stampante: string; tipo: string; stato: string; documento: DocumentoStampa; tentativi: number }>('select id,stampante,tipo,stato,documento,tentativi from stampe order by creata_il,stampante')
const testi = async (db: Db) => (await lavori(db)).map(l => testoSemplice(l.documento))
const stampaTutto = async (db: Db) => { for (const l of await prendiLavori(db)) await registraEsito(db,l.id,{ ok: true }) }
const statoComande = async (db: Db, ordineId: string) => db.query<{ reparto: string; stato: string; stampata: boolean; portata: boolean }>(
  'select reparto,stato,stampata_il is not null as stampata,portata_il is not null as portata from comande where ordine_id=$1 order by reparto',[ordineId])

describe('accodare le comande', () => {
  it('senza reparti su carta non si stampa niente (come oggi)', async () => {
    await ordina({ banco: 1,cucina: 1 })
    expect(await lavori(ambiente.db)).toEqual([])
  })
  it('al tavolo: un biglietto per reparto su carta, con le sue righe; le bevande restano alla sala', async () => {
    const { db } = ambiente
    await carta(db)
    await ordina({ banco: 2,cucina: 1,sala: 3 })
    const l = await lavori(db)
    expect(l.map(x => [x.stampante,x.tipo,x.stato])).toEqual([['banco','comanda','in_coda'],['cucina','comanda','in_coda']])
    const [banco,cucina] = await testi(db)
    expect(banco).toContain('BANCO SUSHI'); expect(banco).toContain('TAVOLO 5'); expect(banco).toContain('2 x 1 Salmone'); expect(banco).toContain('Altri reparti: cucina 1, sala 3')
    expect(cucina).toContain('CUCINA'); expect(cucina).not.toContain('Salmone')
  })
  it('bevande su carta: alla stampante della cassa', async () => {
    const { db } = ambiente
    await carta(db,{ sala: true })
    await ordina({ banco: 1,sala: 2 })
    expect((await lavori(db)).map(x => x.stampante)).toEqual(['cassa'])
  })
  it('da casa: dal sito solo all’accettazione e con la fascia spostata; dalla cassa subito; annullato → biglietto ANNULLATO', async () => {
    const { db } = ambiente
    const { piatto } = await preparaCasa(db)
    await carta(db)
    const o = await ordineAsporto(db,piatto)
    expect(await lavori(db)).toEqual([])
    await accettaOrdine(db,o.id,15)
    expect(await testi(db)).toEqual([expect.stringContaining('ASPORTO ORE 18:45')])
    expect((await testi(db))[0]).toContain('Anna')
    await stampaTutto(db)
    await annullaOrdineCasa(db,o.id)
    expect((await lavori(db)).map(x => [x.tipo,x.stampante])).toEqual([['comanda','banco'],['annullo','banco']])
    const dallaCassa = await creaOrdineCasa(db,{ righe: [{ piattoId: piatto,quantita: 1,nota: '' }],totaleVistoCent: 600,chiaveInvio: randomUUID(),rete: null,adesso: ADESSO,prova: false,origine: 'cassa',
      dati: { tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: new Date('2026-10-12T17:00:00Z'),nome: 'Bruno',telefono: '3339876543',email: null,pagamento: 'contanti',contantiDaCent: null } })
    if (!dallaCassa.ok) throw new Error(dallaCassa.errore)
    expect((await testi(db)).at(-1)).toContain('Bruno')
  })
})

describe('il ponte prende e riporta', () => {
  it('prende i lavori una volta sola, segna il ponte vivo; il lavoro scaduto torna in coda', async () => {
    const { db } = ambiente
    await carta(db)
    await ordina({ banco: 1,cucina: 1 })
    expect((await statoCoda(db)).ponteVistoIl).toBeNull()
    const presi = await prendiLavori(db)
    expect(presi.map(l => l.stampante)).toEqual(['banco','cucina'])
    expect(await prendiLavori(db)).toEqual([])
    expect((await statoCoda(db))).toMatchObject({ inCoda: 2,piuVecchia: null })
    expect((await statoCoda(db)).ponteVistoIl).toBeInstanceOf(Date)
    await db.query(`update stampe set presa_il=now()-interval '2 minutes'`)
    expect((await prendiLavori(db)).map(l => l.id).sort()).toEqual(presi.map(l => l.id).sort())
    expect((await lavori(db)).map(l => l.tentativi)).toEqual([2,2])
  })
  it('stampata: la comanda passa in preparazione, va in «Da portare»; «Portate» la chiude e l’ordine è servito', async () => {
    const { db } = ambiente
    await carta(db)
    const o = await ordina({ banco: 1,cucina: 1 })
    expect(await chiudiSessione(db,sessione)).toMatchObject({ ok: false,motivo: 'ordini_in_cucina' })
    await stampaTutto(db)
    expect(await statoComande(db,o.id)).toEqual([{ reparto: 'banco',stato: 'in_preparazione',stampata: true,portata: false },{ reparto: 'cucina',stato: 'in_preparazione',stampata: true,portata: false }])
    expect((await ordiniDellaSessione(db,sessione))[0].stato).toBe('in_preparazione')
    const voci = await daPortare(db)
    expect(voci.map(v => [v.reparto,v.stato])).toEqual([['banco','in_preparazione'],['cucina','in_preparazione']])
    // Già stampate: chiudere il tavolo non chiede conferma per la cucina.
    const t2 = await creaTavolo(db,'Tavolo 6','tavolo-6'), s2 = (await apriSessione(db,t2.id)).id
    const e = await creaOrdineTavolo(db,s2,[{ piattoId: piatti.banco,quantita: 1,nota: '' }],randomUUID()); if (!e.ok) throw new Error(e.errore)
    await stampaTutto(db)
    expect(await chiudiSessione(db,s2)).toEqual({ ok: true })
    for (const v of voci) expect(await portaComanda(db,v.id)).toBe(true)
    expect(await portaComanda(db,voci[0].id)).toBeNull()
    expect(await statoComande(db,o.id)).toEqual([{ reparto: 'banco',stato: 'pronta',stampata: true,portata: true },{ reparto: 'cucina',stato: 'pronta',stampata: true,portata: true }])
    expect((await ordiniDellaSessione(db,sessione))[0].stato).toBe('servito')
    expect(await daPortare(db)).toEqual([])
  })
  it('non riuscita: torna in coda fino a 5 tentativi, poi errore; si può riprovare; un esito tardivo non cambia niente', async () => {
    const { db } = ambiente
    await carta(db,{ banco: true })
    await ordina({ banco: 1 })
    for (let i = 1; i <= 5; i++) {
      const [l] = await prendiLavori(db)
      expect(await registraEsito(db,l.id,{ ok: false,errore: 'carta finita' })).toBe(true)
      expect((await lavori(db))[0].stato).toBe(i < 5 ? 'in_coda' : 'errore')
    }
    const [l] = await lavori(db)
    expect(await registraEsito(db,l.id,{ ok: true })).toBe(false)
    expect(await lavoriInErrore(db)).toMatchObject([{ id: l.id,stampante: 'banco',errore: 'carta finita' }])
    expect((await statoCoda(db)).errori).toBe(1)
    expect(await riprovaLavoro(db,l.id)).toBe(true)
    expect(await riprovaLavoro(db,l.id)).toBe(false)
    await stampaTutto(db)
    expect((await lavori(db))[0].stato).toBe('stampata')
  })
  it('ristampa: nuovi biglietti con la scritta RISTAMPA', async () => {
    const { db } = ambiente
    await carta(db)
    const o = await ordina({ banco: 1,cucina: 1 })
    await stampaTutto(db)
    expect(await ristampaOrdine(db,o.id)).toBe(2)
    expect((await testi(db)).slice(2).every(t => t.includes('RISTAMPA'))).toBe(true)
    await carta(db,{})
    expect(await ristampaOrdine(db,o.id)).toBe(0)
    expect(await ristampaOrdine(db,'x')).toBe(0)
  })
})

describe('annulli', () => {
  it('comanda ancora in coda: il biglietto si corregge, o non esce più', async () => {
    const { db } = ambiente
    await carta(db)
    const o = await ordina({ banco: 2,cucina: 1 })
    const piatto2 = (await db.query<{ id: string }>("select id from piatti where categoria_id='tartare' order by posizione offset 1 limit 1"))[0].id
    const e = await creaOrdineTavolo(db,sessione,[{ piattoId: piatti.banco,quantita: 1,nota: '' },{ piattoId: piatto2,quantita: 1,nota: '' }],randomUUID()); if (!e.ok) throw new Error(e.errore)
    await annullaRiga(db,e.ordine.righe[0].id,UTENTE)
    const dopo = await lavori(db)
    expect(dopo.filter(l => l.tipo === 'annullo')).toEqual([])
    expect(testoSemplice(dopo.at(-1)!.documento)).not.toContain('1 x 1 Salmone')
    await annullaRiga(db,o.righe.find(r => r.reparto === 'cucina')!.id,UTENTE)
    expect((await lavori(db)).find(l => l.stampante === 'cucina')!.stato).toBe('annullata')
  })
  it('comanda già stampata: biglietto ANNULLATO al reparto, solo con le righe tolte (riga, voce del conto, ordine intero)', async () => {
    const { db } = ambiente
    await carta(db)
    const o = await ordina({ banco: 2,cucina: 1 })
    await stampaTutto(db)
    await annullaRiga(db,o.righe.find(r => r.reparto === 'cucina')!.id,UTENTE)
    let annulli = (await lavori(db)).filter(l => l.tipo === 'annullo')
    expect(annulli.map(l => l.stampante)).toEqual(['cucina'])
    expect(testoSemplice(annulli[0].documento)).toContain('ANNULLATO')
    const o2 = await ordina({ banco: 1 })
    await stampaTutto(db)
    const [voce] = (await contoSessione(db,sessione))!.voci
    await annullaVoceConto(db,sessione,voce,UTENTE)
    annulli = (await lavori(db)).filter(l => l.tipo === 'annullo')
    // La voce raccoglie le righe di due ordini: un biglietto per ordine.
    expect(annulli.map(l => l.stampante)).toEqual(['cucina','banco','banco'])
    expect(testoSemplice(annulli[1].documento)).toContain('2 x 1 Salmone')
    expect(testoSemplice(annulli[2].documento)).toContain('1 x 1 Salmone')
    const o3 = await ordina({ banco: 1,cucina: 2 })
    await stampaTutto(db)
    await annullaOrdine(db,o3.id,UTENTE)
    expect((await lavori(db)).filter(l => l.tipo === 'annullo').length).toBe(5)
    expect(o2.id).not.toBe(o3.id)
  })
})
