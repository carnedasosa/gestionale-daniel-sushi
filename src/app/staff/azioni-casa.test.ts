import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), revalidatePath: vi.fn(), impostaApertura: vi.fn(), accettaOrdine: vi.fn(), rifiutaOrdine: vi.fn(), avanzaOrdineCasa: vi.fn(), annullaOrdineCasa: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/casa/impostazioni-repo', () => ({ impostaApertura: m.impostaApertura }))
vi.mock('@/casa/ordini-casa-repo', () => ({ accettaOrdine: m.accettaOrdine, rifiutaOrdine: m.rifiutaOrdine, avanzaOrdineCasa: m.avanzaOrdineCasa, annullaOrdineCasa: m.annullaOrdineCasa }))
import { accettaOrdineStaff, annullaOrdineCasaStaff, apriOrdiniOnline, avanzaOrdineCasaStaff, chiudiOrdiniOnline, rifiutaOrdineStaff } from './azioni-casa'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); for (const f of [m.accettaOrdine,m.rifiutaOrdine,m.avanzaOrdineCasa,m.annullaOrdineCasa]) f.mockResolvedValue({ id }) })
it('apertura e chiusura degli ordini online di oggi (data di Roma)', async () => {
  vi.useFakeTimers({ now: new Date('2026-10-12T22:30:00Z') })
  try { expect(await apriOrdiniOnline()).toEqual({ ok: true }) } finally { vi.useRealTimers() }
  expect(m.impostaApertura).toHaveBeenCalledWith({},'2026-10-13')
  expect(await chiudiOrdiniOnline()).toEqual({ ok: true }); expect(m.impostaApertura).toHaveBeenLastCalledWith({},null)
  expect(m.revalidatePath).toHaveBeenCalledWith('/ordina')
})
it('ogni azione verifica lo staff prima del repository', async () => {
  const azioni = [() => apriOrdiniOnline(),() => accettaOrdineStaff(id,15),() => rifiutaOrdineStaff(id,'Fascia piena',''),() => avanzaOrdineCasaStaff(id,'accettato'),() => annullaOrdineCasaStaff(id)]
  for (const a of azioni) { m.richiediRuolo.mockClear(); expect(await a()).toEqual({ ok: true }); expect(m.richiediRuolo).toHaveBeenCalledWith('staff') }
  expect(m.accettaOrdine).toHaveBeenCalledWith({},id,15)
  expect(m.rifiutaOrdine).toHaveBeenCalledWith({},id,'Fascia piena')
  expect(m.avanzaOrdineCasa).toHaveBeenCalledWith({},id,'accettato')
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  for (const a of azioni) await expect(a()).rejects.toThrow('NEXT_REDIRECT')
})
it('valori non validi non arrivano al repository', async () => {
  expect((await accettaOrdineStaff(id,20)).ok).toBe(false)
  expect((await accettaOrdineStaff('x',0)).ok).toBe(false)
  expect(await rifiutaOrdineStaff(id,'Altro','  ')).toEqual({ ok: false,errore: 'Scegli un motivo, oppure scrivilo in «Altro».' })
  expect((await avanzaOrdineCasaStaff(id,'servito')).ok).toBe(false)
  expect((await annullaOrdineCasaStaff('x')).ok).toBe(false)
  expect(m.accettaOrdine).not.toHaveBeenCalled(); expect(m.rifiutaOrdine).not.toHaveBeenCalled(); expect(m.avanzaOrdineCasa).not.toHaveBeenCalled(); expect(m.annullaOrdineCasa).not.toHaveBeenCalled()
  expect(await rifiutaOrdineStaff(id,'Altro',' Manca il fattorino ')).toEqual({ ok: true }); expect(m.rifiutaOrdine).toHaveBeenCalledWith({},id,'Manca il fattorino')
})
it('ordine già cambiato da un altro tablet ed errori del DB', async () => {
  m.accettaOrdine.mockResolvedValueOnce(null)
  expect(await accettaOrdineStaff(id,0)).toEqual({ ok: false,errore: 'Operazione non disponibile: aggiorna lo schermo.' })
  m.annullaOrdineCasa.mockRejectedValueOnce(new Error('connessione'))
  expect(await annullaOrdineCasaStaff(id)).toEqual({ ok: false,errore: 'Operazione non riuscita, riprova.' })
})
