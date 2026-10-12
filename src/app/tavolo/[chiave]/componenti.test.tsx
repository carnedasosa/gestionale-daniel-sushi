import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ inviaOrdine: vi.fn(), entraAlTavolo: vi.fn(), inizializzaDispositivo: vi.fn(), pulisciCookieTavolo: vi.fn() }))
import { OrdinatoFinora } from './OrdinatoFinora'
import { CardPiatto } from '@/ordinare/CardPiatto'
import { ModuloCodice } from './ModuloCodice'
import { Carrello } from '@/ordinare/Carrello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
it('il composer mostra gli allergeni solo quando sono passati, altrimenti rimanda al personale', () => {
  const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
  expect(renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} />)).toContain('chiedi al personale')
  const html = renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} allergeni={{ Base: { Riso: ['sesamo'] } }} />)
  expect(html).toContain('Allergeni della tua poke: nessuno dei 14 allergeni'); expect(html).not.toContain('chiedi al personale')
})
it('il carrello da casa porta al riepilogo invece di inviare', () => {
  const html = renderToStaticMarkup(<Carrello righe={[]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} azione="Vai al riepilogo" />)
  expect(html).toContain('Vai al riepilogo'); expect(html).not.toContain('Invia ordine')
})
import type { OrdineClient } from '@/tavoli/ordini-repo'
import type { Piatto } from '@/menu/repo'
it('ordini: stato, note, riga barrata e totale senza ordini annullati', () => {
  const o: OrdineClient = { id: 'o', numero: 1, stato: 'in_preparazione', totaleCent: 600, creatoIl: '2026-10-11T18:00:00Z', sessioneId: 's', tavoloNome: 'Uno',tavoloChiuso: false, righe: [{ id: 'r', numero: 1, nome: 'Salmone', prezzoUnitCent: 600, quantita: 1, nota: 'senza sesamo', poke: null, annullata: false }, { id: 'r2', numero: 2, nome: 'Tonno', prezzoUnitCent: 700, quantita: 1, nota: null, poke: null, annullata: true }] }
  const html = renderToStaticMarkup(<OrdinatoFinora ordini={[o,{ ...o,id: 'o2',numero: 2,stato: 'annullato',totaleCent: 600 }]} />)
  expect(html).toContain('In preparazione'); expect(html).toContain('senza sesamo'); expect(html).toContain('<s>'); expect(html).toContain('annullato'); expect(html).toContain('Totale finora'); expect(html).toContain('6,00\u00a0€'); expect(html).not.toContain('12,00')
})
it('piatto esaurito mostra allergeni e nessun bottone Aggiungi', () => {
  const p: Piatto = { id: 'p', categoriaId: 'x', numero: 1, nome: 'Salmone', descrizione: null, prezzoCent: 600, piccante: false, vegetariano: false, dellaCasa: false, allergeni: ['pesce'], allergeniConfermati: true, disponibile: false, posizione: 0 }
  const html = renderToStaticMarkup(<CardPiatto piatto={p} quantita={0} modifica={() => {}} />)
  expect(html).toContain('Esaurito'); expect(html).toContain('Allergeni: Pesce'); expect(html).not.toContain('Aggiungi')
})
it('il saluto «tavolo chiuso» sparisce se il tavolo è stato riaperto', () => {
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso />)).toContain('Il tavolo è chiuso')
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso tavoloAperto />)).not.toContain('Il tavolo è chiuso')
})
it('una poke da ricomporre non mostra un prezzo e il totale lo dice', () => {
  const html = renderToStaticMarkup(<Carrello righe={[{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] },nome: 'Poke composta',prezzoCent: 0,daRicomporre: true }]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} />)
  expect(html).toContain('Poke composta · —'); expect(html).toContain('senza le poke da ricomporre'); expect(html).not.toContain('Poke composta · 0,00')
})
