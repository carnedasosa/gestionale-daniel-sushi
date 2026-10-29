import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, creaTavolo, impostaCoperti } from '@/tavoli/repo'
import { contoSessione, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { salvaImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { annullaPagamento, registraPagamento, statoPagamenti, type RichiestaPagamento } from '@/cassa/pagamenti-repo'
import { prendiLavori } from '@/stampa/stampe-repo'
import { perIlPonte } from '@/stampa/ponte'
import { chiaveVoce, type MetodoPagamento } from '@/domain/divisione-conto'
import { leggiImpostazioniFiscali, registraEsitoPonte, richiediScontrino, risolviIncerto, salvaImpostazioniFiscali } from './scontrini-repo'
import { totaleRighe, type DocumentoCommerciale } from './documento'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'

const UTENTE = '22222222-2222-4222-8222-222222222222'
const RISPOSTA_OK = (n: number) => `<response success="true" code="" status="2"><addInfo><fiscalReceiptNumber>${n}</fiscalReceiptNumber><fiscalReceiptDate>29/10/2026</fiscalReceiptDate><zRepNumber>301</zRepNumber></addInfo></response>`
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, salmone: string, coca: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 5','tavolo-5')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  salmone = (await ambiente.db.query<{ id: string }>('select id from piatti where numero=1'))[0].id // 6,00 €
  coca = (await ambiente.db.query<{ id: string }>("select id from piatti where nome='Coca Cola'"))[0].id // 2,00 €
})
afterEach(async () => { await ambiente.pg.close() })
const ordina = async (righe: [string,number][]) => { const e = await creaOrdineTavolo(ambiente.db,sessione,righe.map(([piattoId,quantita]) => ({ piattoId,quantita,nota: '' })),randomUUID()); if (!e.ok) throw new Error(e.errore) }
const paga = async (r: RichiestaPagamento, metodo: MetodoPagamento = 'contanti') => { const e = await registraPagamento(ambiente.db,{ sessioneId: sessione },r,metodo,UTENTE); if (!e.ok) throw new Error(e.errore); return e.pagamento.id }
const documenti = async (db: Db) => (await db.query<{ documento: DocumentoCommerciale }>(`select documento from stampe where tipo='scontrino' order by creata_il`)).map(r => r.documento)
/** Il ponte prende lo scontrino e il registratore risponde come Epson. */
const ponteRisponde = async (db: Db, risposta: Parameters<typeof registraEsitoPonte>[1] extends infer E ? (id: string) => E : never) => {
  for (const l of await prendiLavori(db)) if (l.stampante === 'fiscale') await registraEsitoPonte(db,risposta(l.id))
}
const scontrinoDi = async (db: Db, id: string) => (await statoPagamenti(db,{ sessioneId: sessione }))!.pagamenti.find(p => p.id === id)!

describe('righe dello scontrino', () => {
  it('conto intero: piatto per piatto e coperto, coi reparti fiscali', async () => {
    const { db } = ambiente
    await salvaImpostazioniCassa(db,{ copertoCent: 200,stampa: { banco: false,cucina: false,sala: false } })
    await salvaImpostazioniFiscali(db,{ repartoCoperto: 3,repartoConsegna: 1,indiceCarta: 2,automatico: false },{ beverage: 2 })
    await ordina([[salmone,2],[coca,1]])
    await impostaCoperti(db,sessione,2)
    const id = await paga({ modo: 'tutto' },'carta')
    expect(await richiediScontrino(db,id)).toEqual({ ok: true })
    const [d] = await documenti(db)
    expect(d).toEqual({ righe: [
      { descrizione: '1 Salmone',quantita: 2,prezzoUnitCent: 600,reparto: 1 },
      { descrizione: 'Coca Cola',quantita: 1,prezzoUnitCent: 200,reparto: 2 },
      { descrizione: 'Coperto',quantita: 2,prezzoUnitCent: 200,reparto: 3 },
    ],pagamento: { metodo: 'carta',importoCent: 1800,indice: 2 } })
    expect((await scontrinoDi(db,id)).scontrino).toBe('in_coda')
    // Al ponte arriva l'XML per l'RT.
    const [l] = await prendiLavori(db)
    const p = perIlPonte(l)
    expect(p).toMatchObject({ stampante: 'fiscale',formato: 'fpmate' })
    expect(p.dati).toContain('department="2"'); expect(p.dati).toContain('paymentType="2" index="2"')
  })
  it('alla romana con due aliquote: ogni scontrino torna con la sua quota, i reparti in proporzione', async () => {
    const { db } = ambiente
    await salvaImpostazioniFiscali(db,{ repartoCoperto: 1,repartoConsegna: 1,indiceCarta: 1,automatico: false },{ beverage: 2 })
    await ordina([[salmone,3],[coca,2]]) // 18,00 al reparto 1, 4,00 al reparto 2
    const totale = (await contoSessione(db,sessione))!.totaleCent
    for (let rimaste = 3; rimaste > 0; rimaste--) expect(await richiediScontrino(db,await paga({ modo: 'romana',persone: rimaste }))).toEqual({ ok: true })
    const docs = await documenti(db)
    expect(docs.map(d => d.pagamento.importoCent)).toEqual([734,733,733])
    expect(docs.reduce((s,d) => s + totaleRighe(d.righe),0)).toBe(totale)
    for (const d of docs) {
      expect(totaleRighe(d.righe)).toBe(d.pagamento.importoCent)
      expect(d.righe.map(r => r.descrizione)).toEqual(['Quota conto Tavolo 5','Quota conto Tavolo 5'])
      const rep2 = d.righe.find(r => r.reparto === 2)!.prezzoUnitCent
      expect(Math.abs(rep2 - d.pagamento.importoCent * 400 / 2200)).toBeLessThan(1)
    }
  })
  it('per piatti, poi il saldo: righe vere anche per il residuo', async () => {
    const { db } = ambiente
    await ordina([[salmone,3],[coca,1]])
    const voce = (await contoSessione(db,sessione))!.voci.find(v => v.nome === 'Salmone')!
    const a = await paga({ modo: 'piatti',porzioni: [{ chiave: chiaveVoce(voce),quantita: 1 }],coperti: 0 })
    const b = await paga({ modo: 'tutto' })
    await richiediScontrino(db,a); await richiediScontrino(db,b)
    const [da,db2] = await documenti(db)
    expect(da.righe).toEqual([{ descrizione: '1 Salmone',quantita: 1,prezzoUnitCent: 600,reparto: 1 }])
    expect(db2.righe).toEqual([{ descrizione: '1 Salmone',quantita: 2,prezzoUnitCent: 600,reparto: 1 },{ descrizione: 'Coca Cola',quantita: 1,prezzoUnitCent: 200,reparto: 1 }])
  })
  it('importo libero e poi saldo: quote proporzionali', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const a = await paga({ modo: 'importo',importoCent: 250 }), b = await paga({ modo: 'tutto' })
    await richiediScontrino(db,a); await richiediScontrino(db,b)
    expect((await documenti(db)).map(d => d.righe)).toEqual([[{ descrizione: 'Quota conto Tavolo 5',quantita: 1,prezzoUnitCent: 250,reparto: 1 }],[{ descrizione: 'Quota conto Tavolo 5',quantita: 1,prezzoUnitCent: 350,reparto: 1 }]])
  })
  it('asporto e domicilio: righe dell’ordine e la consegna nel suo reparto', async () => {
    const { db } = ambiente
    const { piatto } = await preparaCasa(db)
    await salvaImpostazioniFiscali(db,{ repartoCoperto: 1,repartoConsegna: 4,indiceCarta: 1,automatico: false },{})
    const o = await ordineAsporto(db,piatto)
    const e = await registraPagamento(db,{ ordineId: o.id },{ modo: 'tutto' },'carta',UTENTE); if (!e.ok) throw new Error(e.errore)
    expect(await richiediScontrino(db,e.pagamento.id)).toEqual({ ok: true })
    expect((await documenti(db))[0].righe).toEqual([{ descrizione: '1 Salmone',quantita: 2,prezzoUnitCent: 600,reparto: 1 }])
    expect((await leggiImpostazioniFiscali(db)).repartoConsegna).toBe(4)
  })
})

describe('esiti del registratore', () => {
  it('emesso: numero sul pagamento, niente secondo scontrino, il pagamento non si toglie più', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const id = await paga({ modo: 'tutto' })
    await richiediScontrino(db,id)
    expect(await richiediScontrino(db,id)).toMatchObject({ ok: false })
    await ponteRisponde(db,id2 => ({ id: id2,ok: true,risposta: RISPOSTA_OK(12) }))
    expect(await scontrinoDi(db,id)).toMatchObject({ scontrino: 'emesso',scontrinoNumero: '12' })
    expect(await richiediScontrino(db,id)).toMatchObject({ ok: false })
    expect(await annullaPagamento(db,id,UTENTE)).toBe('scontrino')
  })
  it('rifiutato dall’RT o connessione mai partita: errore, si può rimandare', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const id = await paga({ modo: 'tutto' })
    await richiediScontrino(db,id)
    await ponteRisponde(db,l => ({ id: l,ok: true,risposta: '<response success="false" code="EPTR_REC_EMPTY"/>' }))
    expect(await scontrinoDi(db,id)).toMatchObject({ scontrino: 'errore',scontrinoErrore: expect.stringContaining('EPTR_REC_EMPTY') })
    expect(await richiediScontrino(db,id)).toEqual({ ok: true })
    await ponteRisponde(db,l => ({ id: l,ok: false,errore: 'registratore non raggiungibile (ECONNREFUSED)',incerto: false }))
    expect((await scontrinoDi(db,id)).scontrino).toBe('errore')
    expect(await annullaPagamento(db,id,UTENTE)).toBe('ok')
  })
  it('senza risposta o risposta illeggibile: incerto, non riparte da solo; la cassa decide', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const id = await paga({ modo: 'tutto' })
    await richiediScontrino(db,id)
    await ponteRisponde(db,l => ({ id: l,ok: false,errore: 'tempo scaduto',incerto: true }))
    expect((await scontrinoDi(db,id)).scontrino).toBe('incerto')
    expect(await richiediScontrino(db,id)).toMatchObject({ ok: false,errore: expect.stringContaining('Controlla') })
    expect(await prendiLavori(db)).toEqual([])
    expect(await risolviIncerto(db,id,false)).toBe(true)
    expect(await risolviIncerto(db,id,false)).toBe(false)
    expect(await richiediScontrino(db,id)).toEqual({ ok: true })
    await ponteRisponde(db,l => ({ id: l,ok: true,risposta: '<html>?</html>' }))
    expect((await scontrinoDi(db,id)).scontrino).toBe('incerto')
    expect(await risolviIncerto(db,id,true)).toBe(true)
    expect((await scontrinoDi(db,id)).scontrino).toBe('emesso')
  })
  it('lavoro fiscale preso e mai riportato: dopo il limite diventa incerto anche sul pagamento', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const id = await paga({ modo: 'tutto' })
    await richiediScontrino(db,id)
    await prendiLavori(db)
    await db.query(`update stampe set presa_il=now()-interval '2 minutes'`)
    expect(await prendiLavori(db)).toEqual([])
    expect((await scontrinoDi(db,id)).scontrino).toBe('incerto')
    expect((await db.query<{ stato: string }>(`select stato from stampe`))[0].stato).toBe('incerta')
  })
  it('ponte in prova: scontrino «di prova», il pagamento resta modificabile', async () => {
    const { db } = ambiente
    await ordina([[salmone,1]])
    const id = await paga({ modo: 'tutto' })
    await richiediScontrino(db,id)
    await ponteRisponde(db,l => ({ id: l,ok: true,risposta: 'PROVA' }))
    expect((await scontrinoDi(db,id)).scontrino).toBe('prova')
    expect(await annullaPagamento(db,id,UTENTE)).toBe('ok')
    expect(await richiediScontrino(db,id)).toMatchObject({ ok: false,errore: 'Il pagamento è stato tolto.' })
  })
})
