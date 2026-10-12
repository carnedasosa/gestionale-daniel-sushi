import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(),refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ chiudiTavolo: vi.fn() }))
import { AvvisoContoCambiato, ChiusuraConto } from './ChiusuraConto'
const base = { vistoAlle: '2026-10-11T20:00:00.000Z',ordiniIds: ['a'],totaleCent: 2100 }
it('nessun avviso se non sono arrivati ordini nuovi, anche se il totale è sceso', () => {
  expect(renderToStaticMarkup(<AvvisoContoCambiato base={base} attuale={{ ...base,vistoAlle: '2026-10-11T20:00:10.000Z',totaleCent: 1500 }} ricontrollato={() => {}} />)).toBe('')
})
it('segnala gli ordini arrivati dopo l’apertura del conto con il vecchio e il nuovo totale', () => {
  const html = renderToStaticMarkup(<AvvisoContoCambiato base={base} attuale={{ vistoAlle: '2026-10-11T20:00:10.000Z',ordiniIds: ['a','b'],totaleCent: 3300 }} ricontrollato={() => {}} />)
  expect(html).toContain('È arrivato 1 nuovo ordine'); expect(html).toContain('21,00'); expect(html).toContain('33,00'); expect(html).toContain('Ho ricontrollato il conto')
})
it('al primo render il riferimento è il conto attuale e la chiusura resta il bottone distruttivo', () => {
  const html = renderToStaticMarkup(<ChiusuraConto sessioneId="s" attuale={base} />)
  expect(html).not.toContain('nuovo ordine'); expect(html).toContain('ds-btn--destructive'); expect(html).toContain('Chiudi tavolo')
})
