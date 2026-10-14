import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation',() => ({ usePathname: () => '/admin/menu/abc' }))
import { NavAdmin } from './NavAdmin'
it('evidenzia la sezione corrente (anche nelle sottopagine) e mostra il badge degli allergeni', () => {
  const html = renderToStaticMarkup(<NavAdmin daConfermare={12} uscita={<button>Esci</button>} />)
  expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/menu"|<a[^>]*href="\/admin\/menu"[^>]*aria-current="page"/)
  expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/poke"|<a[^>]*href="\/admin\/poke"[^>]*aria-current="page"/)
  expect(html).toContain('12'); expect(html).toContain('Domicilio e asporto'); expect(html).toContain('Schermo staff'); expect(html).toContain('Esci')
})
it('senza piatti da confermare nessun badge', () => {
  expect(renderToStaticMarkup(<NavAdmin daConfermare={0} uscita={null} />)).not.toContain('b-badge')
})
