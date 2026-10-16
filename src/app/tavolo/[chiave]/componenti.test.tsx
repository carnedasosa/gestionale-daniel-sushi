import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ inviaOrdine: vi.fn(), entraAlTavolo: vi.fn(), inizializzaDispositivo: vi.fn(), pulisciCookieTavolo: vi.fn() }))
import { OrdinatoFinora } from '@/ordinare/OrdinatoFinora'
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
  const o: OrdineClient = { id: 'o', numero: 1, stato: 'in_preparazione', totaleCent: 600, creatoIl: '2026-10-11T18:00:00Z', sessioneId: 's', tavoloNome: 'Uno',tavoloChiuso: false, origine: 'cliente', righe: [{ id: 'r', numero: 1, nome: 'Salmone', prezzoUnitCent: 600, quantita: 1, nota: 'senza sesamo', poke: null, annullata: false }, { id: 'r2', numero: 2, nome: 'Tonno', prezzoUnitCent: 700, quantita: 1, nota: null, poke: null, annullata: true }] }
  const html = renderToStaticMarkup(<OrdinatoFinora ordini={[o,{ ...o,id: 'o2',numero: 2,stato: 'annullato',totaleCent: 600 }]} />)
  expect(html).toContain('In preparazione'); expect(html).toContain('senza sesamo'); expect(html).toContain('<s>'); expect(html).toContain('annullato'); expect(html).toContain('Totale del tavolo finora'); expect(html).toContain('Mandato alle'); expect(html).toContain('b-stato--preparazione'); expect(html).toContain('6,00\u00a0€'); expect(html).not.toContain('12,00')
})
it('ordini: l’ordine del cameriere porta il chip «Dal cameriere», quello del cliente no; la vista dello staff rimanda ai conti', () => {
  const o: OrdineClient = { id: 'o', numero: 1, stato: 'inviato', totaleCent: 600, creatoIl: '2026-10-11T18:00:00Z', sessioneId: 's', tavoloNome: 'Uno',tavoloChiuso: false, origine: 'cameriere', righe: [] }
  const cliente = renderToStaticMarkup(<OrdinatoFinora ordini={[o,{ ...o,id: 'o2',numero: 2,origine: 'cliente' }]} />)
  expect(cliente.match(/>Dal cameriere</g)).toHaveLength(1); expect(cliente).toContain('Il conto lo fai alla cassa')
  const staff = renderToStaticMarkup(<OrdinatoFinora ordini={[o]} vista="staff" />)
  expect(staff).toContain('dal cameriere'); expect(staff).toContain('scheda Conti'); expect(staff).not.toContain('Il conto lo fai alla cassa')
})
it('piatto esaurito mostra allergeni e nessun bottone Aggiungi', () => {
  const p: Piatto = { id: 'p', categoriaId: 'x', numero: 1, nome: 'Salmone', descrizione: null, prezzoCent: 600, piccante: false, vegetariano: false, dellaCasa: false, allergeni: ['pesce'], allergeniConfermati: true, disponibile: false, posizione: 0 }
  const html = renderToStaticMarkup(<CardPiatto piatto={p} quantita={0} modifica={() => {}} />)
  expect(html).toContain('Esaurito'); expect(html).toContain('Allergeni: Pesce'); expect(html).not.toContain('Aggiungi')
})
it('piatto disponibile: «+» con nome accessibile, poi «− n +»; al massimo 20', () => {
  const p: Piatto = { id: 'p', categoriaId: 'x', numero: 1, nome: 'Salmone', descrizione: 'Tartare', prezzoCent: 600, piccante: true, vegetariano: false, dellaCasa: true, allergeni: [], allergeniConfermati: true, disponibile: true, posizione: 0 }
  const zero = renderToStaticMarkup(<CardPiatto piatto={p} quantita={0} modifica={() => {}} />)
  expect(zero).toContain('aria-label="Aggiungi Salmone"'); expect(zero).toContain('Della casa'); expect(zero).toContain('Piccante')
  const venti = renderToStaticMarkup(<CardPiatto piatto={p} quantita={20} modifica={() => {}} />)
  expect(venti).toContain('aria-label="Riduci Salmone"'); expect(venti).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Aumenta Salmone"|<button[^>]*aria-label="Aumenta Salmone"[^>]*disabled=""/); expect(venti).toContain('>20<')
})
it('il saluto «tavolo chiuso» sparisce se il tavolo è stato riaperto', () => {
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso />)).toContain('Il tavolo è chiuso')
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso tavoloAperto />)).not.toContain('Il tavolo è chiuso')
})
it('una poke da ricomporre non mostra un prezzo e il totale lo dice', () => {
  const html = renderToStaticMarkup(<Carrello righe={[{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] },nome: 'Poke composta',prezzoCent: 0,daRicomporre: true }]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} />)
  expect(html).toContain('Poke composta</span><span class="b-num">—</span>'); expect(html).toContain('senza le poke da ricomporre'); expect(html).not.toContain('Poke composta</span><span class="b-num">0,00')
})
it('poke a passi: un gruppo alla volta, avanti bloccato finché il gruppo non va', () => {
  const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 },{ nome: 'Salse',voci: ['Soia'],min: 0,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
  const html = renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} />)
  expect(html).toContain('Passo 1 di 2'); expect(html).toContain('Riso'); expect(html).not.toContain('Soia')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Avanti: Salse/); expect(html).toContain('Scegli almeno 1 in Base')
  expect(html).not.toContain('Aggiungi al carrello')
})
it('poke a passi: l’ultimo passo facoltativo offre «Nessuno» e l’aggiunta al carrello', () => {
  const config = { titolo: 'Poke',gruppi: [{ nome: 'Salse',voci: ['Soia','Teriyaki'],min: 0,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
  const html = renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} />)
  expect(html).toContain('Passo 1 di 1'); expect(html).toContain('Nessuno'); expect(html).toMatch(/<button[^>]*>Aggiungi al carrello/); expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Aggiungi al carrello/)
})
it('barra del carrello: nome accessibile che comincia con il testo visibile (WCAG 2.5.3), poi quantità e totale', () => {
  const html = renderToStaticMarkup(<Carrello righe={[{ piattoId: 'p',quantita: 2,nota: '',nome: 'Salmone',prezzoCent: 600,daRicomporre: false }]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} azione="Vai al riepilogo" etichettaBarra="Vedi il carrello" />)
  expect(html).toContain('aria-label="Vedi il carrello · 2 piatti · 12,00\u00a0€"'); expect(html).toContain('Vedi il carrello'); expect(html).toContain('Nota per la cucina')
})
