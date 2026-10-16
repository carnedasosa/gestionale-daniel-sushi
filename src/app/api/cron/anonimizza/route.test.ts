import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ anonimizza: vi.fn(), reti: vi.fn(), tentativi: vi.fn(), email: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/casa/ordini-casa-repo', () => ({ anonimizzaOrdiniCasa: m.anonimizza, azzeraRetiVecchie: m.reti }))
vi.mock('@/tavoli/repo', () => ({ eliminaTentativiVecchi: m.tentativi }))
vi.mock('@/casa/email-repo', () => ({ emailInErroreDefinitivo: m.email }))
import { GET } from './route'
const segreto = 'abcdefghijklmnop1234'
const richiesta = (auth?: string) => new Request('http://localhost/api/cron/anonimizza',{ headers: auth ? { authorization: auth } : {} })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); vi.spyOn(console,'log').mockImplementation(() => {}); vi.stubEnv('CRON_SECRET',segreto) })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
it('senza il segreto giusto risponde 401 e non tocca il database', async () => {
  expect((await GET(richiesta())).status).toBe(401)
  expect((await GET(richiesta('Bearer sbagliato'))).status).toBe(401)
  vi.stubEnv('CRON_SECRET','')
  expect((await GET(richiesta('Bearer '))).status).toBe(401)
  expect(m.anonimizza).not.toHaveBeenCalled(); expect(m.reti).not.toHaveBeenCalled(); expect(m.tentativi).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled()
  expect(console.log).not.toHaveBeenCalled()
})
it('con il segreto fa le tre pulizie con la stessa ora e dice quante righe ha toccato e quante email sono in errore, senza cache', async () => {
  m.anonimizza.mockResolvedValueOnce(3); m.reti.mockResolvedValueOnce(5); m.tentativi.mockResolvedValueOnce(42)
  m.email.mockResolvedValueOnce({ n: 2,ultimoErrore: 'Resend 429',ultimaIl: new Date() })
  const ok = await GET(richiesta(`Bearer ${segreto}`))
  expect(ok.status).toBe(200); expect(ok.headers.get('Cache-Control')).toBe('no-store')
  expect(await ok.json()).toEqual({ anonimizzati: 3,retiAzzerate: 5,tentativiEliminati: 42,emailInErrore: 2 })
  expect(console.log).toHaveBeenCalledTimes(1)
  expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0])).toEqual({ evento: 'cron_anonimizza',anonimizzati: 3,retiAzzerate: 5,tentativiEliminati: 42,emailInErrore: 2 })
  const adesso = m.anonimizza.mock.calls[0][1]
  expect(adesso).toBeInstanceOf(Date)
  expect(m.reti).toHaveBeenCalledWith({},adesso); expect(m.tentativi).toHaveBeenCalledWith({},adesso)
})
it('errore del DB in una pulizia → 500 col messaggio nei log; le pulizie successive saltano', async () => {
  m.anonimizza.mockResolvedValueOnce(0); m.reti.mockRejectedValueOnce(new Error('connessione'))
  const ko = await GET(richiesta(`Bearer ${segreto}`))
  expect(ko.status).toBe(500); expect(await ko.json()).toEqual({ errore: 'Anonimizzazione non riuscita' })
  expect(console.error).toHaveBeenCalledWith('connessione')
  expect(m.tentativi).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled(); expect(console.log).not.toHaveBeenCalled()
})
