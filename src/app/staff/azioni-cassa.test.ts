import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(),revalidatePath: vi.fn(),creaOrdineCasa: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('next/cache',() => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/casa/ordini-casa-repo',() => ({ creaOrdineCasa: m.creaOrdineCasa }))
import { inviaOrdineCassa } from './azioni-cassa'
const piatto = '11111111-1111-4111-8111-111111111111', chiaveInvio = '22222222-2222-4222-8222-222222222222'
const dati = { tipo: 'asporto',fascia: '2026-10-12T17:15:00.000Z',nome: 'Anna',telefono: '3331234567',pagamento: 'contanti',forzaFascia: true }
const json = (diverso: Record<string,unknown> = {}) => JSON.stringify({ righe: [{ piattoId: piatto,quantita: 2,nota: '' }],dati,totaleVistoCent: 1200,chiaveInvio,...diverso })
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {})
  m.creaOrdineCasa.mockResolvedValue({ ok: true,ordine: { token: 't'.repeat(32),numero: 4807,numeroGiorno: 7 } })
})
it('verifica lo staff prima del repository e passa origine cassa, forzatura e nessuna rete', async () => {
  expect(await inviaOrdineCassa(json())).toEqual({ ok: true,token: 't'.repeat(32),numero: 7 })
  expect(m.richiediRuolo).toHaveBeenCalledWith('staff')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.creaOrdineCasa.mock.invocationCallOrder[0])
  expect(m.creaOrdineCasa).toHaveBeenCalledWith({},expect.objectContaining({ origine: 'cassa',forzaFascia: true,rete: null,totaleVistoCent: 1200,chiaveInvio,dati: expect.objectContaining({ nome: 'Anna',email: null }) }))
  for (const p of ['/staff','/','/ordina']) expect(m.revalidatePath).toHaveBeenCalledWith(p)
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(inviaOrdineCassa(json())).rejects.toThrow('NEXT_REDIRECT')
})
it('json rotto, dati mancanti o carrello non valido non arrivano al repository', async () => {
  expect((await inviaOrdineCassa('{')).ok).toBe(false)
  expect(await inviaOrdineCassa(json({ dati: { ...dati,telefono: '' } }))).toMatchObject({ ok: false,errori: { telefono: expect.any(String) } })
  expect((await inviaOrdineCassa(json({ righe: [] }))).ok).toBe(false)
  expect(m.creaOrdineCasa).not.toHaveBeenCalled()
})
it('errori del repository: campo evidenziato, prezzi cambiati, eccezione', async () => {
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'L’orario scelto è già passato: scegline un altro.',campo: 'fascia',fasce: [] })
  expect(await inviaOrdineCassa(json())).toMatchObject({ ok: false,errori: { fascia: expect.stringContaining('già passato') },fasce: [] })
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'I prezzi sono cambiati',campo: 'carrello',totaleCent: 1300 })
  expect(await inviaOrdineCassa(json())).toEqual({ ok: false,errore: 'I prezzi sono cambiati',totaleCent: 1300 })
  m.creaOrdineCasa.mockRejectedValueOnce(new Error('connessione'))
  expect(await inviaOrdineCassa(json())).toMatchObject({ ok: false,errore: expect.stringContaining('Non siamo sicuri') })
  m.creaOrdineCasa.mockRejectedValueOnce(Object.assign(new Error('lock scaduto'),{ code: '55P03' }))
  expect(await inviaOrdineCassa(json())).toMatchObject({ ok: false,errore: expect.stringContaining('sistema è occupato') })
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
