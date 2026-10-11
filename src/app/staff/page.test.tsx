import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const m = vi.hoisted(() => ({ ruolo: vi.fn(),elenco: vi.fn(),ordini: vi.fn(),riepiloghi: vi.fn(),conti: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.ruolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('@/tavoli/repo',() => ({ elencoTavoli: m.elenco,contiRecenti: m.conti }))
vi.mock('@/tavoli/ordini-repo',() => ({ ordiniAttivi: m.ordini,riepiloghiTavoli: m.riepiloghi }))
vi.mock('@/app/accesso/azioni',() => ({ esci: vi.fn() }))
vi.mock('next/navigation',() => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import AreaStaff from './page'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.elenco.mockResolvedValue([]); m.ordini.mockResolvedValue([]); m.riepiloghi.mockResolvedValue([]); m.conti.mockResolvedValue([]) })
it('mantiene intestazione e tentativi automatici se falliscono le letture DB', async () => {
  m.elenco.mockRejectedValueOnce(new Error('DB giù'))
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).toContain('Area staff'); expect(html).toContain('Database non raggiungibile, riprovo da solo')
})
it('i redirect del ruolo propagano senza essere convertiti in errori DB', async () => {
  m.ruolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(AreaStaff()).rejects.toThrow('NEXT_REDIRECT')
  expect(m.elenco).not.toHaveBeenCalled()
})
