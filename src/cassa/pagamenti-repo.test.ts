import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, chiudiSessione, creaTavolo, impostaCoperti } from '@/tavoli/repo'
import { annullaVoceConto, contoSessione, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { salvaImpostazioniCassa } from './impostazioni-repo'
import { annullaPagamento, registraPagamento, statoPagamenti } from './pagamenti-repo'
import { chiaveVoce } from '@/domain/divisione-conto'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'

const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, p1: string, p2: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 5','tavolo-5')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  ;[p1,p2] = (await ambiente.db.query<{ id: string }>('select id from piatti where numero in (1,2) order by numero')).map(r => r.id)
})
afterEach(async () => { await ambiente.pg.close() })
const ordina = async (righe: { piattoId: string; quantita: number }[]) => {
  const e = await creaOrdineTavolo(ambiente.db,sessione,righe.map(r => ({ ...r,nota: '' })),randomUUID()); if (!e.ok) throw new Error(e.errore); return e.ordine
}

it('alla romana in tre su un totale con coperti: le quote sommano esattamente il conto', async () => {
  const { db } = ambiente
  await salvaImpostazioniCassa(db,{ copertoCent: 150,stampa: { banco: false,cucina: false,sala: false } })
  await ordina([{ piattoId: p1,quantita: 3 },{ piattoId: p2,quantita: 1 }])
  await impostaCoperti(db,sessione,3)
  const totale = (await contoSessione(db,sessione))!.totaleCent
  const quote: number[] = []
  for (let rimaste = 3; rimaste > 0; rimaste--) {
    const e = await registraPagamento(db,{ sessioneId: sessione },{ modo: 'romana',persone: rimaste },rimaste % 2 ? 'contanti' : 'carta',UTENTE)
    if (!e.ok) throw new Error(e.errore)
    quote.push(e.pagamento.importoCent)
  }
  expect(quote.reduce((s,q) => s + q,0)).toBe(totale)
  expect(Math.max(...quote) - Math.min(...quote)).toBeLessThanOrEqual(1)
  expect(await statoPagamenti(db,{ sessioneId: sessione })).toMatchObject({ totaleCent: totale,pagatoCent: totale,residuoCent: 0 })
  expect(await registraPagamento(db,{ sessioneId: sessione },{ modo: 'tutto' },'contanti',UTENTE)).toEqual({ ok: false,errore: 'Il conto è già saldato.' })
})
it('per piatti: ognuno paga le sue porzioni, il resto lo salda il conto intero', async () => {
  const { db } = ambiente
  await ordina([{ piattoId: p1,quantita: 3 }])
  const conto = (await contoSessione(db,sessione))!
  const voce = conto.voci[0], chiave = chiaveVoce(voce)
  const a = await registraPagamento(db,{ sessioneId: sessione },{ modo: 'piatti',porzioni: [{ chiave,quantita: 1 }],coperti: 0 },'carta',UTENTE)
  expect(a).toMatchObject({ ok: true,pagamento: { importoCent: voce.prezzoUnitCent,modo: 'piatti',descrizione: 'Per piatti',dettaglio: { porzioni: [{ chiave,quantita: 1,nome: voce.nome }],coperti: 0 } } })
  // Le porzioni pagate non si ripagano.
  expect(await registraPagamento(db,{ sessioneId: sessione },{ modo: 'piatti',porzioni: [{ chiave,quantita: 3 }],coperti: 0 },'carta',UTENTE)).toMatchObject({ ok: false })
  const s = (await statoPagamenti(db,{ sessioneId: sessione }))!
  expect(s.pagato.porzioni.get(chiave)).toBe(1)
  const saldo = await registraPagamento(db,{ sessioneId: sessione },{ modo: 'tutto' },'contanti',UTENTE)
  expect(saldo).toMatchObject({ ok: true,pagamento: { importoCent: 2 * voce.prezzoUnitCent,descrizione: 'Saldo' } })
})
it('importo libero oltre il residuo rifiutato; pagamento annullato torna nel residuo', async () => {
  const { db } = ambiente
  const o = await ordina([{ piattoId: p1,quantita: 2 }])
  expect(await registraPagamento(db,{ sessioneId: sessione },{ modo: 'importo',importoCent: o.totaleCent + 1 },'contanti',UTENTE)).toMatchObject({ ok: false })
  const e = await registraPagamento(db,{ sessioneId: sessione },{ modo: 'importo',importoCent: 500 },'contanti',UTENTE)
  if (!e.ok) throw new Error(e.errore)
  expect(await annullaPagamento(db,e.pagamento.id,UTENTE)).toBe('ok')
  expect(await annullaPagamento(db,e.pagamento.id,UTENTE)).toBe('non_disponibile')
  expect(await statoPagamenti(db,{ sessioneId: sessione })).toMatchObject({ pagatoCent: 0,residuoCent: o.totaleCent,pagamenti: [{ annullato: true }] })
})
it('si incassa anche a tavolo chiuso; un annullo dopo il pagamento lascia un residuo negativo da restituire', async () => {
  const { db } = ambiente
  const o = await ordina([{ piattoId: p1,quantita: 2 }])
  await chiudiSessione(db,sessione,null,true)
  expect(await registraPagamento(db,{ sessioneId: sessione },{ modo: 'tutto' },'carta',UTENTE)).toMatchObject({ ok: true,pagamento: { importoCent: o.totaleCent } })
  const t = await creaTavolo(db,'Tavolo 6','tavolo-6'), s2 = (await apriSessione(db,t.id)).id
  const e = await creaOrdineTavolo(db,s2,[{ piattoId: p1,quantita: 2,nota: '' }],randomUUID()); if (!e.ok) throw new Error(e.errore)
  await registraPagamento(db,{ sessioneId: s2 },{ modo: 'tutto' },'carta',UTENTE)
  const [v] = (await contoSessione(db,s2))!.voci
  await annullaVoceConto(db,s2,v,UTENTE)
  expect(await statoPagamenti(db,{ sessioneId: s2 })).toMatchObject({ totaleCent: 0,residuoCent: -e.ordine.totaleCent })
})
it('richieste e destinazioni non valide', async () => {
  const { db } = ambiente
  await ordina([{ piattoId: p1,quantita: 1 }])
  for (const r of [{ modo: 'romana',persone: 0 },{ modo: 'romana',persone: 51 },{ modo: 'importo',importoCent: 0 },{ modo: 'piatti',porzioni: 'x',coperti: 0 },{ modo: 'boh' }])
    expect(await registraPagamento(db,{ sessioneId: sessione },r as never,'contanti',UTENTE)).toEqual({ ok: false,errore: 'Pagamento non valido.' })
  expect(await registraPagamento(db,{ sessioneId: sessione },{ modo: 'tutto' },'assegno' as never,UTENTE)).toMatchObject({ ok: false })
  expect(await registraPagamento(db,{ sessioneId: 'x' },{ modo: 'tutto' },'carta',UTENTE)).toMatchObject({ ok: false })
  expect(await registraPagamento(db,{ sessioneId: randomUUID() },{ modo: 'tutto' },'carta',UTENTE)).toMatchObject({ ok: false,errore: expect.stringContaining('Conto non trovato') })
  expect(await statoPagamenti(db,{ sessioneId: 'x' })).toBeNull()
})
it('ordini da casa: si incassa il totale (consegna compresa), niente romana né piatti', async () => {
  const { db } = ambiente
  const { piatto } = await preparaCasa(db)
  const o = await ordineAsporto(db,piatto)
  expect(await registraPagamento(db,{ ordineId: o.id },{ modo: 'romana',persone: 2 },'carta',UTENTE)).toMatchObject({ ok: false })
  expect(await registraPagamento(db,{ ordineId: o.id },{ modo: 'tutto' },'carta',UTENTE)).toMatchObject({ ok: true,pagamento: { importoCent: o.totaleCent } })
  expect(await statoPagamenti(db,{ ordineId: o.id })).toMatchObject({ residuoCent: 0 })
})
