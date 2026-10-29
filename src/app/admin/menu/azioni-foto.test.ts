import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), salvaFoto: vi.fn(), togliFoto: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/menu/foto-repo', () => ({ salvaFoto: m.salvaFoto,togliFoto: m.togliFoto }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { caricaFotoPiatto, rimuoviFotoPiatto } from './azioni-foto'
const id = '11111111-1111-4111-8111-111111111111'
const modulo = (byte = 200) => { const fd = new FormData(); fd.set('foto',new Blob([new Uint8Array(byte)]),'foto'); fd.set('larghezza','800'); fd.set('altezza','600'); return fd }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: 'u',ruolo: 'admin' }) })

it('carica: admin prima del repo, passa byte e dimensioni, rivalida il menù', async () => {
  m.salvaFoto.mockResolvedValue({ ok: true,foto: {} })
  expect(await caricaFotoPiatto(id,modulo())).toEqual({ ok: true })
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.salvaFoto.mock.invocationCallOrder[0])
  expect(m.salvaFoto).toHaveBeenCalledWith(expect.anything(),id,expect.any(Uint8Array),800,600)
  expect(m.revalidatePath).toHaveBeenCalledWith('/')
})
it('carica: niente file, troppo grande, errori del repo e del DB', async () => {
  expect(await caricaFotoPiatto(id,new FormData())).toMatchObject({ ok: false })
  expect(await caricaFotoPiatto(id,modulo(401 * 1024))).toMatchObject({ ok: false,errore: expect.stringContaining('400 KB') })
  expect(await caricaFotoPiatto('x',modulo())).toMatchObject({ ok: false })
  expect(m.salvaFoto).not.toHaveBeenCalled()
  m.salvaFoto.mockResolvedValueOnce({ ok: false,errore: 'Formato non riconosciuto' })
  expect(await caricaFotoPiatto(id,modulo())).toEqual({ ok: false,errore: 'Formato non riconosciuto' })
  m.salvaFoto.mockRejectedValueOnce(new Error('giù'))
  expect(await caricaFotoPiatto(id,modulo())).toMatchObject({ ok: false,errore: expect.stringContaining('Salvataggio non riuscito') })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
it('rimuovi: admin prima, già tolta spiegata, redirect propagato', async () => {
  m.togliFoto.mockResolvedValueOnce(true)
  expect(await rimuoviFotoPiatto(id)).toEqual({ ok: true })
  m.togliFoto.mockResolvedValueOnce(false)
  expect(await rimuoviFotoPiatto(id)).toMatchObject({ ok: false })
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(rimuoviFotoPiatto(id)).rejects.toThrow('NEXT_REDIRECT')
})
