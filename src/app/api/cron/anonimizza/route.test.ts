import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ anonimizza: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/casa/ordini-casa-repo', () => ({ anonimizzaOrdiniCasa: m.anonimizza }))
import { GET } from './route'
const segreto = 'abcdefghijklmnop1234'
const richiesta = (auth?: string) => new Request('http://localhost/api/cron/anonimizza',{ headers: auth ? { authorization: auth } : {} })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); vi.stubEnv('CRON_SECRET',segreto) })
afterEach(() => { vi.unstubAllEnvs() })
it('senza il segreto giusto risponde 401 e non tocca il database', async () => {
  expect((await GET(richiesta())).status).toBe(401)
  expect((await GET(richiesta('Bearer sbagliato'))).status).toBe(401)
  vi.stubEnv('CRON_SECRET','')
  expect((await GET(richiesta('Bearer '))).status).toBe(401)
  expect(m.anonimizza).not.toHaveBeenCalled()
})
it('con il segreto anonimizza e dice quanti ordini; errore del DB → 500', async () => {
  m.anonimizza.mockResolvedValueOnce(3)
  const ok = await GET(richiesta(`Bearer ${segreto}`))
  expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ anonimizzati: 3 })
  m.anonimizza.mockRejectedValueOnce(new Error('connessione'))
  expect((await GET(richiesta(`Bearer ${segreto}`))).status).toBe(500)
})
