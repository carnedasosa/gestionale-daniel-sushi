import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation',() => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../azioni-cassa',() => ({ inviaOrdineCassa: vi.fn() }))
import { ModuloCassa } from './ModuloCassa'
import type { DisponibilitaCassa } from './NuovoOrdineCassa'
import type { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import type { Piatto } from '@/menu/repo'
const piatto: Piatto = { id: 'p1',categoriaId: 'tartare',numero: 1,nome: 'Salmone',descrizione: null,prezzoCent: 600,piccante: false,vegetariano: false,dellaCasa: false,allergeni: [],allergeniConfermati: true,disponibile: true,posizione: 0,foto: null }
const righe = [{ piattoId: 'p1',quantita: 3,nota: '' }]
const carrello = { carrello: { righe,chiaveInvio: 'k' },ref: { current: { righe,chiaveInvio: 'k' } },caricato: true,bloccato: { current: false },imposta: vi.fn(),modificaRighe: vi.fn(),modificaPiatto: vi.fn(),aggiungiPoke: vi.fn(),svuota: vi.fn(),blocca: () => true,sblocca: vi.fn() } as unknown as ReturnType<typeof useCarrelloSalvato>
const F1 = '2026-10-12T16:30:00.000Z', F2 = '2026-10-12T16:45:00.000Z'
const d: DisponibilitaCassa = {
  zone: [{ id: 'z',nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 }],occupazione: [{ fascia: F1,totale: 4,domicilio: 1 }],regole: { capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30 },
  servizi: { asporto: { aperto: true,motivo: null,forzabile: true,fasce: [F2],future: [F1,F2] },domicilio: { aperto: false,motivo: 'Consegne a domicilio non disponibili.',forzabile: false,fasce: [],future: [] } },
}
it('orari con occupazione, pieni barrati e forzabili; email facoltativa; niente privacy', () => {
  const html = renderToStaticMarkup(<ModuloCassa carrello={carrello} piatti={[piatto]} poke={null} disponibilita={d} inviato={() => {}} />)
  expect(html).toContain('<s>18:30</s>'); expect(html).toContain('4/4'); expect(html).toContain('>18:45<'); expect(html).toContain('0/4')
  expect(html).toContain('Forza: accetta anche un orario pieno'); expect(html).toContain('facoltativa, non riceve nulla')
  expect(html).not.toContain('informativa privacy'); expect(html).toMatch(/aria-label="Manda in cucina [^"]*18,00.€"/)
  expect(html).toContain('Consegne a domicilio non disponibili.')
})
it('senza orari futuri lo dice, e un servizio chiuso non per le fasce non si forza', () => {
  const chiuso: DisponibilitaCassa = { ...d,servizi: { ...d.servizi,asporto: { aperto: false,motivo: 'Oggi siamo chiusi.',forzabile: false,fasce: [],future: [] } } }
  const html = renderToStaticMarkup(<ModuloCassa carrello={carrello} piatti={[piatto]} poke={null} disponibilita={chiuso} inviato={() => {}} />)
  expect(html).toContain('Nessun orario di oggi ancora da venire.'); expect(html).not.toContain('Forza:'); expect(html).toContain('Oggi siamo chiusi.')
  expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Manda in cucina/)
})
