import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), leggiPokeConfig: vi.fn(), salvaPokeConfig: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/tavoli/poke-repo', () => ({ leggiPokeConfig: m.leggiPokeConfig, salvaPokeConfig: m.salvaPokeConfig }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { salvaPoke, type StatoPoke } from './azioni'
const stato: StatoPoke = { salvato: false, errore: null, valori: null, invii: 0 }
function fd() { const f = new FormData(); f.set('base','9,00'); f.set('extra','1,00'); f.set('min_0','1'); f.set('max_0','1'); f.set('inclusi_0','1'); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.leggiPokeConfig.mockResolvedValue({ titolo: 'Poke', gruppi: [{ nome: 'Base', voci: ['Riso'], min: 1, max: 1, inclusi: 1 }], prezzoBaseCent: null, prezzoExtraCent: null }) })
it('salva prezzi e regole dopo la verifica admin', async () => {
  expect((await salvaPoke(stato,fd())).salvato).toBe(true)
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.leggiPokeConfig.mock.invocationCallOrder[0])
  expect(m.salvaPokeConfig.mock.calls[0][1]).toMatchObject({ prezzoBaseCent: 900, prezzoExtraCent: 100 })
})
it('preserva i valori se le regole o i prezzi non sono validi', async () => {
  const f = fd(); f.set('max_0','5')
  const s = await salvaPoke(stato,f)
  expect(s.salvato).toBe(false); expect(s.valori?.gruppi[0].max).toBe('5'); expect(s.invii).toBe(1)
  expect(m.salvaPokeConfig).not.toHaveBeenCalled()
  f.set('base',''); expect((await salvaPoke(stato,f)).errore).toBeTruthy()
})
it('propaga redirect e gestisce errore DB', async () => {
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(salvaPoke(stato,fd())).rejects.toThrow('NEXT_REDIRECT')
  m.leggiPokeConfig.mockRejectedValueOnce(new Error('connessione'))
  expect((await salvaPoke(stato,fd())).errore).toBeTruthy()
})
