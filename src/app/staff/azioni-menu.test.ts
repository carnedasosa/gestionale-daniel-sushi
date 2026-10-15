import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), impostaDisponibile: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/menu/repo', () => ({ impostaDisponibile: m.impostaDisponibile }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { cambiaDisponibilitaStaff } from './azioni-menu'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })
it('lo staff segna un piatto esaurito con il solo ruolo staff e tutti gli schermi si aggiornano', async () => {
  m.impostaDisponibile.mockResolvedValue(true)
  expect(await cambiaDisponibilitaStaff('id',false)).toEqual({ ok: true })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.impostaDisponibile.mock.invocationCallOrder[0])
  expect(m.impostaDisponibile).toHaveBeenCalledWith({},'id',false)
  for (const p of ['/staff','/admin/menu','/']) expect(m.revalidatePath).toHaveBeenCalledWith(p)
})
it('senza ruolo staff non scrive nulla', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(cambiaDisponibilitaStaff('id',false)).rejects.toThrow('NEXT_REDIRECT')
  expect(m.impostaDisponibile).not.toHaveBeenCalled()
})
it('se il salvataggio fallisce restituisce il messaggio da mostrare sotto l’interruttore', async () => {
  m.impostaDisponibile.mockRejectedValue(new Error('connessione'))
  expect(await cambiaDisponibilitaStaff('id',true)).toEqual({ ok: false,errore: 'Salvataggio non riuscito: controlla la connessione e riprova.' })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
