import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ annullaVoceStaff: vi.fn() }))
import { VoceConto } from './VoceConto'
const voce = { nome: 'Salmone',numero: 1,prezzoUnitCent: 600,poke: null,quantita: 2,importoCent: 1200 }
const riga = (modificabile: boolean) => renderToStaticMarkup(<table><tbody><VoceConto sessioneId="s" voce={voce} modificabile={modificabile} /></tbody></table>)
it('«Annulla» solo finché il conto è aperto', () => {
  expect(riga(true)).toContain('>Annulla<')
  expect(riga(false)).not.toContain('Annulla')
  expect(riga(false)).toContain('12,00')
})
