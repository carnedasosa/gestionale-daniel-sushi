import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ prendiLavori: vi.fn(),registraEsito: vi.fn() }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('@/stampa/stampe-repo',() => ({ prendiLavori: m.prendiLavori }))
vi.mock('@/fiscale/scontrini-repo',() => ({ registraEsitoPonte: m.registraEsito }))
import { GET } from './coda/route'
import { POST } from './esito/route'
import { testo } from '@/stampa/documento'

const TOKEN = 't'.repeat(40)
const con = (auth?: string, corpo?: unknown) => new Request('http://x/api/stampa',{ method: corpo === undefined ? 'GET' : 'POST',headers: auth ? { authorization: auth } : {},body: corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo) })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); vi.stubEnv('STAMPA_TOKEN',TOKEN) })
afterEach(() => { vi.unstubAllEnvs() })

it('senza token configurato 503, con token sbagliato o corto 401, senza toccare la coda', async () => {
  vi.stubEnv('STAMPA_TOKEN','')
  expect((await GET(con(`Bearer ${TOKEN}`))).status).toBe(503)
  vi.stubEnv('STAMPA_TOKEN','corto')
  expect((await GET(con('Bearer corto'))).status).toBe(401)
  vi.stubEnv('STAMPA_TOKEN',TOKEN)
  expect((await GET(con('Bearer sbagliato'))).status).toBe(401)
  expect((await GET(con())).status).toBe(401)
  expect((await POST(con('Bearer sbagliato',{ id: 'x',ok: true }))).status).toBe(401)
  expect(m.prendiLavori).not.toHaveBeenCalled(); expect(m.registraEsito).not.toHaveBeenCalled()
})
it('coda: lavori come byte ESC/POS in base64 con anteprima, mai in cache', async () => {
  m.prendiLavori.mockResolvedValue([{ id: 'l1',stampante: 'banco',tipo: 'comanda',documento: { righe: [testo('TAVOLO 5')] },creataIl: new Date(),pagamentoId: null }])
  const r = await GET(con(`Bearer ${TOKEN}`))
  expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('no-store')
  const { lavori } = await r.json()
  expect(lavori).toEqual([{ id: 'l1',stampante: 'banco',tipo: 'comanda',formato: 'escpos',dati: expect.any(String),anteprima: 'TAVOLO 5' }])
  expect(Buffer.from(lavori[0].dati,'base64').includes(Buffer.from('TAVOLO 5\n'))).toBe(true)
  m.prendiLavori.mockRejectedValueOnce(new Error('giù'))
  expect((await GET(con(`Bearer ${TOKEN}`))).status).toBe(500)
})
it('esito: forma controllata, poi al repository', async () => {
  m.registraEsito.mockResolvedValue(true)
  expect(await (await POST(con(`Bearer ${TOKEN}`,{ id: 'l1',ok: true }))).json()).toEqual({ registrato: true })
  expect(m.registraEsito).toHaveBeenLastCalledWith({},{ id: 'l1',ok: true })
  await POST(con(`Bearer ${TOKEN}`,{ id: 'l1',ok: false,errore: 'carta finita',incerto: true }))
  expect(m.registraEsito).toHaveBeenLastCalledWith({},{ id: 'l1',ok: false,errore: 'carta finita',incerto: true })
  for (const corpo of ['non json',{ ok: true },{ id: 'l1' },{ id: 'l1',ok: false },{ id: 'l1',ok: true,risposta: 3 }]) expect((await POST(con(`Bearer ${TOKEN}`,corpo))).status).toBe(400)
})
