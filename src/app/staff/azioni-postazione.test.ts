import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(),cookies: vi.fn(),set: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('next/headers',() => ({ cookies: m.cookies }))
import { impostaPostazione } from './azioni-postazione'
beforeEach(() => { vi.resetAllMocks(); m.cookies.mockResolvedValue({ set: m.set }) })
it('lo staff prima del cookie; cookie della postazione solo sotto /staff', async () => {
  expect(await impostaPostazione('banco')).toEqual({ ok: true })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.cookies.mock.invocationCallOrder[0])
  expect(m.set).toHaveBeenCalledWith('ds_postazione','banco',expect.objectContaining({ path: '/staff',sameSite: 'lax',httpOnly: true,maxAge: 31536000 }))
})
it('postazione non valida o senza ruolo: nessun cookie', async () => {
  expect(await impostaPostazione('bar')).toEqual({ ok: false,errore: 'Postazione non valida.' })
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(impostaPostazione('cassa')).rejects.toThrow('NEXT_REDIRECT')
  expect(m.set).not.toHaveBeenCalled()
})
