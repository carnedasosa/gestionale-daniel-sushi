import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ apriTavolo: vi.fn(), chiudiTavolo: vi.fn(), avanzaOrdine: vi.fn(), annullaOrdineStaff: vi.fn(), annullaRigaStaff: vi.fn() }))
vi.mock('./azioni-casa', () => ({ apriOrdiniOnline: vi.fn(), chiudiOrdiniOnline: vi.fn(), accettaOrdineStaff: vi.fn(), rifiutaOrdineStaff: vi.fn(), avanzaOrdineCasaStaff: vi.fn(), annullaOrdineCasaStaff: vi.fn() }))
import { CardOrdine } from './SchermoStaff'
import { CardOrdineCasa } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import type { OrdineClient } from '@/tavoli/ordini-repo'
const online = { accesi: true,asporto: null,domicilio: 'Consegne a domicilio non disponibili.' }
const tavolo: OrdineClient = { id: 'o',numero: 8,stato: 'inviato',totaleCent: 900,creatoIl: '2026-10-11T18:00:00Z',sessioneId: 's',tavoloNome: 'Tavolo 1',tavoloChiuso: false,righe: [{ id: 'r',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: 'senza sesamo',poke: { Base: ['Riso'],Proteine: ['Tonno'] },annullata: false },{ id: 'r2',numero: 2,nome: 'Salmone',prezzoUnitCent: 600,quantita: 1,nota: null,poke: null,annullata: true }] }
const casa: OrdineCasaClient = { id: 'c',numero: 9,tipo: 'domicilio',stato: 'in_attesa',token: 't'.repeat(32),totaleCent: 2000,consegnaCent: 200,fascia: '2026-10-11T17:30:00.000Z',creatoIl: '2026-10-11T17:00:00.000Z',
  clienteNome: 'Anna',clienteTelefono: '3331234567',clienteEmail: 'anna@esempio.it',zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi',pagamento: 'contanti',contantiDaCent: 5000,motivoRifiuto: null,anonimizzato: false,
  righe: [{ id: 'rc',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 3,nota: null,poke: null,annullata: false }] }
it('evidenzia note e poke, barra annullati e mostra tempo e stato', () => {
  const html = renderToStaticMarkup(<CardOrdine ordine={tavolo} ora="2026-10-11T18:05:00Z" nuovo={true} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).toContain('staff-ordine--nuovo'); expect(html).toContain('senza sesamo'); expect(html).toContain('staff-nota'); expect(html).toContain('Tonno'); expect(html).toContain('<s>'); expect(html).toContain('5 min'); expect(html).toContain('In preparazione')
})
it('senza dati e senza dati precedenti mostra il caricamento invece di smontarsi', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  expect(renderToStaticMarkup(<SchermoStaff dati={null} ora="2026-10-11T18:05:00Z" />)).toContain('Caricamento dello schermo')
  const html = renderToStaticMarkup(<SchermoStaff dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [],casa: [],ordiniOnline: { ...online,accesi: false } }} ora="2026-10-11T18:05:00Z" />)
  expect(html).toContain('Cucina'); expect(html).toContain('Nessun tavolo configurato'); expect(html).toContain('Ordini online: chiusi'); expect(html).toContain('Apri ordini di oggi'); expect(html).toContain('Nessun ordine da accettare')
})
it('ordine da accettare: orario di Roma, cliente, indirizzo, pagamento e i quattro bottoni; evidenziato dopo 10 minuti', () => {
  const html = renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:05:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)
  expect(html).toContain('Domicilio 19:30 · n. 9'); expect(html).toContain('href="tel:3331234567"'); expect(html).toContain('Via Roma 1 · Bitetto · citofono Rossi'); expect(html).toContain('Contanti (paga con 50,00 €)')
  for (const b of ['>Accetta<','Accetta +15’','Accetta +30’','>Rifiuta<']) expect(html).toContain(b)
  expect(html).not.toContain('staff-ordine--attesa')
  expect(renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:11:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)).toContain('In attesa da più di 10 minuti')
})
it('cucina: tavoli e casa insieme per orario, con il passaggio giusto per la casa', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T17:05:00Z" dati={{ tavoli: [],riepiloghi: [],contiRecenti: [],ordiniOnline: online,
    ordini: [tavolo],casa: [{ ...casa,stato: 'accettato' },{ ...casa,id: 'c2',numero: 10,tipo: 'asporto',stato: 'pronto',fascia: '2026-10-11T17:45:00.000Z' },{ ...casa,id: 'c3',numero: 11 }] }} />)
  expect(html).toContain('Ordini online: aperti oggi'); expect(html).toContain('Domicilio: Consegne a domicilio non disponibili.')
  expect(html.indexOf('Domicilio 19:30 · n. 9')).toBeLessThan(html.indexOf('Tavolo 1 · n. 8'))
  expect(html).toContain('Pronti e in consegna'); expect(html).toContain('>Ritirato<')
  expect(html.match(/Accetta \+15/g)).toHaveLength(1)
})
