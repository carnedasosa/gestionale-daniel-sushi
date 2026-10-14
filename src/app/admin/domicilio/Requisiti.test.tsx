import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { requisitiCasa } from '@/domain/apertura-casa'
import { Requisiti } from './Requisiti'
it('requisiti: spunta per quelli a posto, testo e link per quelli da fare', () => {
  const html = renderToStaticMarkup(<Requisiti voci={requisitiCasa({ telefono: '080',allergeniCompleti: false,pokeConfermati: null,zoneAttive: 1 })} />)
  expect(html).toContain('aria-label="Fatto"'); expect(html).toContain('Telefono del locale impostato')
  expect(html).toContain('href="/admin/menu?filtro=allergeni"'); expect(html).toContain('Conferma nel menù'); expect(html).toContain('aria-label="Da fare"')
})
