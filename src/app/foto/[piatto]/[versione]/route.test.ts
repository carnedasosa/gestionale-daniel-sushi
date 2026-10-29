import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ leggiFoto: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/menu/foto-repo', () => ({ leggiFoto: m.leggiFoto }))
import { GET } from './route'
const chiama = (piatto: string,versione: string) => GET(new Request('http://x'),{ params: Promise.resolve({ piatto,versione }) })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })

it('serve la foto con il suo tipo e cache di un anno', async () => {
  m.leggiFoto.mockResolvedValue({ dati: new Uint8Array([1,2,3]),tipo: 'image/webp' })
  const r = await chiama('p','0123456789abcdef')
  expect(r.status).toBe(200)
  expect(r.headers.get('content-type')).toBe('image/webp')
  expect(r.headers.get('cache-control')).toContain('immutable')
  expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1,2,3]))
})
it('404 con cache breve se manca, 503 senza cache se il DB non risponde', async () => {
  m.leggiFoto.mockResolvedValueOnce(null)
  const r = await chiama('p','0123456789abcdef')
  expect(r.status).toBe(404); expect(r.headers.get('cache-control')).toBe('public, max-age=60')
  m.leggiFoto.mockRejectedValueOnce(new Error('giù'))
  const e = await chiama('p','0123456789abcdef')
  expect(e.status).toBe(503); expect(e.headers.get('cache-control')).toBe('no-store')
})
