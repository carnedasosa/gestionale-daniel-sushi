import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, chiudiSessione, creaTavolo, impostaCoperti } from '@/tavoli/repo'
import { contoSessione, creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { salvaImpostazioniCassa } from './impostazioni-repo'
import { registraPagamento } from './pagamenti-repo'
import { accodaPreconto } from './preconto-repo'
import { prendiLavori } from '@/stampa/stampe-repo'
import { testoSemplice } from '@/stampa/escpos'
import type { DocumentoStampa } from '@/stampa/documento'

const UTENTE = '22222222-2222-4222-8222-222222222222'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, sessione: string, piatto: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const t = await creaTavolo(ambiente.db,'Tavolo 5','tavolo-5')
  sessione = (await apriSessione(ambiente.db,t.id)).id
  piatto = (await ambiente.db.query<{ id: string }>('select id from piatti where numero=1'))[0].id // Salmone, 6,00 €
})
afterEach(async () => { await ambiente.pg.close() })
const ordina = async (quantita: number) => { const e = await creaOrdineTavolo(ambiente.db,sessione,[{ piattoId: piatto,quantita,nota: '' }],randomUUID()); if (!e.ok) throw new Error(e.errore) }
const preconti = async () => (await ambiente.db.query<{ documento: DocumentoStampa; stampante: string }>(`select documento,stampante from stampe where tipo='preconto' order by creata_il`))

it('alla stampante della cassa: voci, coperti, totale, pagato, quota a testa e «non fiscale»', async () => {
  const { db } = ambiente
  await salvaImpostazioniCassa(db,{ copertoCent: 200,stampa: { banco: false,cucina: false,sala: false } })
  await ordina(3)
  await impostaCoperti(db,sessione,3)
  await registraPagamento(db,{ sessioneId: sessione },{ modo: 'importo',importoCent: 1000 },'carta',UTENTE)
  expect(await accodaPreconto(db,sessione,3,new Date('2026-10-29T21:15:00Z'))).toBe('ok')
  const [p] = await preconti()
  expect(p.stampante).toBe('cassa')
  const t = testoSemplice(p.documento)
  for (const atteso of ['PRECONTO','TAVOLO 5','29/10/2026 22:15','Coperti: 3','3 x 1 Salmone','18,00 €','3 x Coperto (2,00 €)','6,00 €','TOTALE','24,00 €','Già pagato','10,00 €','Resta da pagare','14,00 €','Diviso per 3','4,66 €-4,67 €','DOCUMENTO NON FISCALE'])
    expect(t).toContain(atteso)
  for (const r of t.split('\n')) expect(r.length).toBeLessThanOrEqual(48)
  // Il ponte lo prende come gli altri lavori.
  expect((await prendiLavori(db)).map(l => l.tipo)).toEqual(['preconto'])
})
it('segna l’ora e conta gli ordini arrivati dopo; conto vuoto e valori non validi rifiutati', async () => {
  const { db } = ambiente
  expect(await accodaPreconto(db,sessione,null)).toBe('vuoto')
  await ordina(1)
  expect(await accodaPreconto(db,sessione,null)).toBe('ok')
  expect(testoSemplice((await preconti())[0].documento)).not.toContain('Diviso')
  expect(await contoSessione(db,sessione)).toMatchObject({ precontoIl: expect.any(Date),ordiniDopoPreconto: 0 })
  await ordina(2)
  expect((await contoSessione(db,sessione))!.ordiniDopoPreconto).toBe(1)
  for (const persone of [0,51,1.5]) expect(await accodaPreconto(db,sessione,persone)).toBe('non_disponibile')
  expect(await accodaPreconto(db,randomUUID(),null)).toBe('non_disponibile')
  await chiudiSessione(db,sessione,null,true)
  expect(await accodaPreconto(db,sessione,null)).toBe('ok')
})
