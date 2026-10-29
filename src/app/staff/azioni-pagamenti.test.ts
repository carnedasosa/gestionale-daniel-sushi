import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), registraPagamento: vi.fn(), annullaPagamento: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/cassa/pagamenti-repo', async (originale) => ({ ...(await originale<typeof import('@/cassa/pagamenti-repo')>()),registraPagamento: m.registraPagamento,annullaPagamento: m.annullaPagamento }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { annullaIncasso, incassa } from './azioni-pagamenti'
const id = '11111111-1111-4111-8111-111111111111', utente = '22222222-2222-4222-8222-222222222222'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: utente,ruolo: 'staff' }) })

it('incassa: staff prima del repo, passa utente e metodo, rivalida', async () => {
  m.registraPagamento.mockResolvedValue({ ok: true,pagamento: {} })
  expect(await incassa({ sessioneId: id },{ modo: 'romana',persone: 3 },'carta')).toEqual({ ok: true })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.registraPagamento.mock.invocationCallOrder[0])
  expect(m.registraPagamento).toHaveBeenCalledWith(expect.anything(),{ sessioneId: id },{ modo: 'romana',persone: 3 },'carta',utente)
  expect(m.revalidatePath).toHaveBeenCalledWith('/staff')
})
it('incassa: rifiuta destinazioni, richieste e metodi non validi senza toccare il DB', async () => {
  for (const [d,r,metodo] of [[{ sessioneId: 'x' },{ modo: 'tutto' },'carta'],[{ sessioneId: id,ordineId: id },{ modo: 'tutto' },'carta'],[null,{ modo: 'tutto' },'carta'],
    [{ sessioneId: id },{ modo: 'romana',persone: 0 },'carta'],[{ sessioneId: id },{ modo: 'tutto' },'bitcoin']] as const)
    expect(await incassa(d as never,r,metodo as never)).toEqual({ ok: false,errore: 'Pagamento non valido.' })
  expect(m.registraPagamento).not.toHaveBeenCalled()
})
it('incassa: errori del repo e del DB in italiano', async () => {
  m.registraPagamento.mockResolvedValueOnce({ ok: false,errore: 'Il conto è già saldato.' })
  expect(await incassa({ ordineId: id },{ modo: 'tutto' },'contanti')).toEqual({ ok: false,errore: 'Il conto è già saldato.' })
  m.registraPagamento.mockRejectedValueOnce(new Error('giù'))
  expect(await incassa({ ordineId: id },{ modo: 'tutto' },'contanti')).toEqual({ ok: false,errore: 'Incasso non registrato, riprova.' })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
it('annulla incasso: staff prima, id valido, già tolto spiegato', async () => {
  m.annullaPagamento.mockResolvedValueOnce('ok')
  expect(await annullaIncasso(id)).toEqual({ ok: true })
  expect(m.annullaPagamento).toHaveBeenCalledWith(expect.anything(),id,utente)
  m.annullaPagamento.mockResolvedValueOnce('non_disponibile')
  expect(await annullaIncasso(id)).toMatchObject({ ok: false })
  m.annullaPagamento.mockClear()
  expect(await annullaIncasso('x')).toMatchObject({ ok: false }); expect(m.annullaPagamento).not.toHaveBeenCalled()
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(annullaIncasso(id)).rejects.toThrow('NEXT_REDIRECT')
})
