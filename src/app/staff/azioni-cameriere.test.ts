import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(),revalidatePath: vi.fn(),creaOrdineTavolo: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('next/cache',() => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/tavoli/ordini-repo',() => ({ creaOrdineTavolo: m.creaOrdineTavolo }))
import { inviaOrdineCameriere } from './azioni-cameriere'
const sessione = '11111111-1111-4111-8111-111111111111', piatto = '22222222-2222-4222-8222-222222222222', chiaveInvio = '33333333-3333-4333-8333-333333333333'
const json = JSON.stringify([{ piattoId: piatto,quantita: 1,nota: '',prezzoCent: 1 }])
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {})
  m.creaOrdineTavolo.mockResolvedValue({ ok: true,ordine: { numero: 12 } })
})
it('verifica lo staff prima del repository, salva con origine cameriere e aggiorna cucina, telefoni e conto', async () => {
  expect(await inviaOrdineCameriere(sessione,json,chiaveInvio)).toEqual({ ok: true,numero: 12 })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.creaOrdineTavolo.mock.invocationCallOrder[0])
  expect(m.creaOrdineTavolo).toHaveBeenCalledWith({},sessione,[{ piattoId: piatto,quantita: 1,nota: '' }],chiaveInvio,'cameriere')
  expect(m.revalidatePath).toHaveBeenCalledWith('/staff')
  expect(m.revalidatePath).toHaveBeenCalledWith('/tavolo/[chiave]','page')
  expect(m.revalidatePath).toHaveBeenCalledWith('/staff/conto/[sessione]','page')
})
it('senza ruolo il redirect di richiediRuolo si propaga e il repository non viene toccato', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(inviaOrdineCameriere(sessione,json,chiaveInvio)).rejects.toThrow('NEXT_REDIRECT')
  expect(m.creaOrdineTavolo).not.toHaveBeenCalled()
})
it('id della sessione o chiave di invio non validi, json rotto e carrello vuoto non arrivano al repository', async () => {
  expect((await inviaOrdineCameriere('x',json,chiaveInvio)).errore).toContain('chiuso')
  expect((await inviaOrdineCameriere(sessione,json,'x')).errore).toContain('Chiave di invio')
  expect((await inviaOrdineCameriere(sessione,'{',chiaveInvio)).ok).toBe(false)
  expect((await inviaOrdineCameriere(sessione,'[]',chiaveInvio)).ok).toBe(false)
  expect((await inviaOrdineCameriere(sessione,42 as unknown as string,chiaveInvio)).ok).toBe(false)
  expect(m.creaOrdineTavolo).not.toHaveBeenCalled(); expect(m.revalidatePath).not.toHaveBeenCalled()
})
it('rifiuto del repository riportato con i piatti esauriti; eccezione del DB diventa un messaggio in italiano', async () => {
  m.creaOrdineTavolo.mockResolvedValueOnce({ ok: false,errore: 'Alcuni piatti non sono più disponibili',nonDisponibili: ['Salmone'],nonDisponibiliIds: [piatto] })
  expect(await inviaOrdineCameriere(sessione,json,chiaveInvio)).toMatchObject({ ok: false,nonDisponibili: ['Salmone'] })
  m.creaOrdineTavolo.mockRejectedValueOnce(new Error('connessione'))
  expect(await inviaOrdineCameriere(sessione,json,chiaveInvio)).toMatchObject({ ok: false,errore: expect.stringContaining('Non siamo sicuri') })
  m.creaOrdineTavolo.mockRejectedValueOnce(Object.assign(new Error('istruzione scaduta'),{ code: '57014' }))
  expect(await inviaOrdineCameriere(sessione,json,chiaveInvio)).toMatchObject({ ok: false,errore: expect.stringContaining('sistema è occupato') })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
