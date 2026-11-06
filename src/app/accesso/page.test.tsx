import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('./azioni', () => ({ entra: vi.fn() }))
import PaginaAccesso from './page'

const pagina = async (errore?: string) => renderToStaticMarkup(await PaginaAccesso({ searchParams: Promise.resolve({ errore }) }))

it('mostra solo i messaggi previsti: un valore scritto a mano nell’indirizzo non appare e non rompe la pagina', async () => {
  expect(await pagina('permessi')).toContain('Non hai i permessi')
  expect(await pagina('uscita')).toContain('rientra ed esci di nuovo')
  for (const errore of [undefined,'<b>finto</b>','constructor']) expect(await pagina(errore)).not.toContain('role="alert"')
})
