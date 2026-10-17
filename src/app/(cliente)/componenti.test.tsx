import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(),push: vi.fn() }) }))
vi.mock('./ordina/azioni', () => ({ inviaOrdineCasa: vi.fn() }))
import { StatoOrdine, ordineConcluso } from './ordine/[token]/StatoOrdine'
import { Checkout, siSceglie } from './ordina/Checkout'
import { etichettaOrdineInCorso } from './OrdineInCorso'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
const ordine: OrdineCasaClient = { id: 'o',numero: 4812,numeroGiorno: 12,tipo: 'domicilio',stato: 'in_attesa',token: 't'.repeat(32),totaleCent: 2000,consegnaCent: 200,fascia: '2026-10-12T17:15:00.000Z',creatoIl: '2026-10-12T16:00:00.000Z',aggiornatoIl: '2026-10-12T16:03:00.000Z',
  clienteNome: 'Anna',clienteTelefono: '3331234567',clienteEmail: 'anna@esempio.it',zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: null,pagamento: 'contanti',contantiDaCent: 5000,motivoRifiuto: null,anonimizzato: false,origine: 'cliente',
  righe: [{ id: 'r',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 3,nota: null,poke: null,annullata: false,reparto: 'banco' }] }
it('stato: in attesa, poi dopo 10 minuti il telefono del locale', () => {
  const presto = renderToStaticMarkup(<StatoOrdine ordine={ordine} telefono="0801234567" ora="2026-10-12T16:05:00.000Z" />)
  expect(presto).toContain('In attesa di conferma'); expect(presto).toContain('consegna verso le 19:15'); expect(presto).toContain('si aggiorna da sola'); expect(presto).not.toContain('Non abbiamo ancora risposto')
  const tardi = renderToStaticMarkup(<StatoOrdine ordine={ordine} telefono="0801234567" ora="2026-10-12T16:11:00.000Z" />)
  expect(tardi).toContain('Non abbiamo ancora risposto'); expect(tardi).toContain('href="tel:0801234567"')
})
it('stato: confermato con orario e pagamento, rifiutato con motivo, anonimizzato', () => {
  const ok = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'accettato' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(ok).toContain('Confermato'); expect(ok).toContain('Consegna verso le 19:15'); expect(ok).toContain('Via Roma 1 · Bitetto'); expect(ok).toContain('in contanti (con 50,00 €)'); expect(ok).toContain('<span>Consegna</span><span class="b-num">2,00 €</span>')
  const asporto = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,tipo: 'asporto',stato: 'pronto',consegnaCent: 0,indirizzo: null,zonaNome: null,pagamento: 'carta' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(asporto).toContain('Pronto per il ritiro'); expect(asporto).toContain('Ritiro alle 19:15'); expect(asporto).toContain('con carta')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'rifiutato',motivoRifiuto: 'Fascia piena' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).toContain('Non possiamo accettare l’ordine: Fascia piena')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,anonimizzato: true }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).toContain('Ordine non più disponibile')
  expect(['rifiutato','annullato','completato','in_consegna'].map(ordineConcluso)).toEqual([true,true,true,false])
})
it('checkout: orari liberi e pieni in ordine, i pieni barrati e non selezionabili; servizio chiuso con motivo; conferma bloccata', () => {
  const html = renderToStaticMarkup(<Checkout piatti={[]} poke={null} disponibilita={{ zone: [],servizi: {
    asporto: { aperto: true,motivo: null,fasce: ['2026-10-12T16:30:00.000Z'],piene: ['2026-10-12T16:15:00.000Z'] },domicilio: { aperto: false,motivo: 'Consegne a domicilio non disponibili.',fasce: [],piene: [] } } }} />)
  expect(html.indexOf('18:15')).toBeLessThan(html.indexOf('18:30')); expect(html).toContain('<s>18:15</s>'); expect(html).toContain('pieno')
  expect(html).toContain('Ritiro alle'); expect(html).toContain('Consegne a domicilio non disponibili.'); expect(html).toContain('informativa privacy')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(<span>)?Conferma l’ordine/)
})
it('checkout: tutti gli orari pieni (servizio chiuso per «fasce») si sceglie lo stesso e mostra gli orari barrati; conferma bloccata', () => {
  const html = renderToStaticMarkup(<Checkout piatti={[]} poke={null} disponibilita={{ zone: [],servizi: {
    asporto: { aperto: false,motivo: 'Nessuna fascia libera per oggi.',fasce: [],piene: ['2026-10-12T16:15:00.000Z'] },domicilio: { aperto: false,motivo: 'Consegne a domicilio non disponibili.',fasce: [],piene: [] } } }} />)
  expect(html).toContain('Nessun orario libero per oggi'); expect(html).toContain('<s>18:15</s>')
  expect(html).toMatch(/<input(?=[^>]*value="asporto")(?=[^>]*checked="")[^>]*>/)
  expect(siSceglie({ aperto: false,motivo: 'x',fasce: [],piene: ['2026-10-12T16:15:00.000Z'] })).toBe(true); expect(siSceglie({ aperto: false,motivo: 'x',fasce: [],piene: [] })).toBe(false)
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(<span>)?Conferma l’ordine/)
})
it('stato: cronologia con ora d’arrivo e ora dello stato attuale; niente cronologia se rifiutato', () => {
  const html = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'in_preparazione' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(html).toContain('Ordine ricevuto'); expect(html).toContain('aria-current="step"'); expect(html).toContain('18:00'); expect(html).toContain('18:03'); expect(html).toContain('In consegna')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'rifiutato',motivoRifiuto: 'Fascia piena' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).not.toContain('Ordine ricevuto')
})
it('ordine in corso: il nome accessibile contiene il testo visibile («Il tuo ordine n. 7», «Segui»)', () => {
  expect(etichettaOrdineInCorso(7)).toBe('Il tuo ordine n. 7 · Segui lo stato')
})
