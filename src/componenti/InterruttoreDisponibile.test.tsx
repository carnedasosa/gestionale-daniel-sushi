import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { InterruttoreDisponibile } from './InterruttoreDisponibile'
it('interruttore accessibile con il nome del piatto e lo stato attuale', () => {
  const html = renderToStaticMarkup(<InterruttoreDisponibile id="a" nome="Salmone" disponibile={false} cambia={async () => ({ ok: true })} />)
  expect(html).toContain('role="switch"'); expect(html).toContain('aria-checked="false"'); expect(html).toContain('Salmone: '); expect(html).toContain('Esaurito')
  expect(html).not.toContain('aria-busy'); expect(html).not.toContain('role="alert"')
})
