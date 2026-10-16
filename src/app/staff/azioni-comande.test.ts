import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(),revalidatePath: vi.fn(),avanzaComanda: vi.fn(),portaComanda: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('next/cache',() => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/comande/comande-repo',() => ({ avanzaComanda: m.avanzaComanda,portaComanda: m.portaComanda }))
import { avanzaComandaStaff, portaComandaStaff } from './azioni-comande'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.avanzaComanda.mockResolvedValue(true); m.portaComanda.mockResolvedValue(true) })
it('avanza: lo staff prima del repository, poi aggiorna schermi, telefoni, conto e pagina del cliente', async () => {
  expect(await avanzaComandaStaff(id,'da_preparare')).toEqual({ ok: true })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.avanzaComanda.mock.invocationCallOrder[0])
  expect(m.avanzaComanda).toHaveBeenCalledWith({},id,'da_preparare')
  for (const p of [['/staff'],['/staff/conto/[sessione]','page'],['/tavolo/[chiave]','page'],['/ordine/[token]','page']]) expect(m.revalidatePath).toHaveBeenCalledWith(...p)
})
it('portate: lo staff prima del repository', async () => {
  expect(await portaComandaStaff(id)).toEqual({ ok: true })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.portaComanda.mock.invocationCallOrder[0])
})
it('senza ruolo il redirect si propaga e il repository non viene toccato', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(avanzaComandaStaff(id,'da_preparare')).rejects.toThrow('NEXT_REDIRECT')
  await expect(portaComandaStaff(id)).rejects.toThrow('NEXT_REDIRECT')
  expect(m.avanzaComanda).not.toHaveBeenCalled(); expect(m.portaComanda).not.toHaveBeenCalled()
})
it('id o stato non validi non arrivano al repository', async () => {
  for (const [i,s] of [['x','da_preparare'],[id,'pronta'],[id,'annullata'],[id,'servito']]) expect((await avanzaComandaStaff(i,s)).errore).toBe('Comanda non valida.')
  expect((await portaComandaStaff('x')).ok).toBe(false)
  expect(m.avanzaComanda).not.toHaveBeenCalled(); expect(m.portaComanda).not.toHaveBeenCalled()
})
it('comanda già cambiata da un altro schermo; errore del DB in italiano, senza aggiornare', async () => {
  m.avanzaComanda.mockResolvedValueOnce(null)
  expect((await avanzaComandaStaff(id,'in_preparazione')).errore).toContain('un altro schermo')
  m.portaComanda.mockRejectedValueOnce(new Error('connessione'))
  expect(await portaComandaStaff(id)).toEqual({ ok: false,errore: 'Operazione non riuscita, riprova.' })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
