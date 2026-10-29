import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), ristampaOrdine: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/stampa/stampe-repo', () => ({ ristampaOrdine: m.ristampaOrdine }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { ristampaComande } from './azioni-stampa'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: 'u',ruolo: 'staff' }) })

it('staff prima del repo; niente da ristampare spiegato; errori del DB in italiano', async () => {
  m.ristampaOrdine.mockResolvedValueOnce(2)
  expect(await ristampaComande(id)).toEqual({ ok: true })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.ristampaOrdine.mock.invocationCallOrder[0])
  m.ristampaOrdine.mockResolvedValueOnce(0)
  expect(await ristampaComande(id)).toMatchObject({ ok: false,errore: expect.stringContaining('Niente da ristampare') })
  m.ristampaOrdine.mockRejectedValueOnce(new Error('giù'))
  expect(await ristampaComande(id)).toEqual({ ok: false,errore: 'Ristampa non riuscita, riprova.' })
  m.ristampaOrdine.mockClear()
  expect(await ristampaComande('x')).toMatchObject({ ok: false }); expect(m.ristampaOrdine).not.toHaveBeenCalled()
})
