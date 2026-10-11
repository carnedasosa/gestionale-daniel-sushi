import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ inviaOrdine: vi.fn() }))
import { OrdinatoFinora } from './OrdinatoFinora'
import { CardPiatto } from './MenuOrdinabile'
import type { OrdineClient } from '@/tavoli/ordini-repo'
import type { Piatto } from '@/menu/repo'
it('ordini: stato, note, riga barrata e totale senza ordini annullati', () => {
  const o: OrdineClient = { id: 'o', numero: 1, stato: 'in_preparazione', totaleCent: 600, creatoIl: '2026-10-11T18:00:00Z', sessioneId: 's', tavoloNome: 'Uno', righe: [{ id: 'r', numero: 1, nome: 'Salmone', prezzoUnitCent: 600, quantita: 1, nota: 'senza sesamo', poke: null, annullata: false }, { id: 'r2', numero: 2, nome: 'Tonno', prezzoUnitCent: 700, quantita: 1, nota: null, poke: null, annullata: true }] }
  const html = renderToStaticMarkup(<OrdinatoFinora ordini={[o,{ ...o,id: 'o2',numero: 2,stato: 'annullato',totaleCent: 600 }]} />)
  expect(html).toContain('In preparazione'); expect(html).toContain('senza sesamo'); expect(html).toContain('<s>'); expect(html).toContain('annullato'); expect(html).toContain('Totale finora'); expect(html).toContain('6,00\u00a0€'); expect(html).not.toContain('12,00')
})
it('piatto esaurito mostra allergeni e nessun bottone Aggiungi', () => {
  const p: Piatto = { id: 'p', categoriaId: 'x', numero: 1, nome: 'Salmone', descrizione: null, prezzoCent: 600, piccante: false, vegetariano: false, dellaCasa: false, allergeni: ['pesce'], allergeniConfermati: true, disponibile: false, posizione: 0 }
  const html = renderToStaticMarkup(<CardPiatto piatto={p} quantita={0} modifica={() => {}} />)
  expect(html).toContain('Esaurito'); expect(html).toContain('Allergeni: Pesce'); expect(html).not.toContain('Aggiungi')
})
