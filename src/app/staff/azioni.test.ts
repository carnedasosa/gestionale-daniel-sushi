import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), apriSessione: vi.fn(), chiudiSessione: vi.fn(), sbloccaSessione: vi.fn(), avanzaStato: vi.fn(), annullaOrdine: vi.fn(), annullaRiga: vi.fn(), annullaVoceConto: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/tavoli/repo', () => ({ apriSessione: m.apriSessione, chiudiSessione: m.chiudiSessione, sbloccaSessione: m.sbloccaSessione }))
vi.mock('@/tavoli/ordini-repo', () => ({ avanzaStato: m.avanzaStato, annullaOrdine: m.annullaOrdine, annullaRiga: m.annullaRiga, annullaVoceConto: m.annullaVoceConto }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { apriTavolo, chiudiTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff } from './azioni'
const id = '11111111-1111-4111-8111-111111111111'
const coppie = [[apriTavolo,m.apriSessione],[chiudiTavolo,m.chiudiSessione],[sbloccaTavolo,m.sbloccaSessione],[avanzaOrdine,m.avanzaStato],[annullaOrdineStaff,m.annullaOrdine],[annullaRigaStaff,m.annullaRiga]] as const
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })
it('ogni azione verifica staff prima del repo, valida id e rivalida dopo successo', async () => {
  for (const [azione,repo] of coppie) {
    repo.mockResolvedValue({ ok: true,id,codice: '1234' })
    expect((await azione(id)).ok).toBe(true)
    expect(m.richiediRuolo).toHaveBeenLastCalledWith('staff')
    expect(m.richiediRuolo.mock.invocationCallOrder.at(-1)!).toBeLessThan(repo.mock.invocationCallOrder.at(-1)!)
    expect(m.revalidatePath).toHaveBeenCalledWith('/staff')
    repo.mockClear()
    expect((await azione('x')).ok).toBe(false); expect(repo).not.toHaveBeenCalled()
  }
})
it('chiusura propaga gli avvisi e accetta solo conferme e date valide', async () => {
  m.chiudiSessione.mockResolvedValueOnce({ ok: false,motivo: 'ordini_in_cucina',n: 2 })
  expect(await chiudiTavolo(id,null,false)).toMatchObject({ ok: false,avviso: { motivo: 'ordini_in_cucina',n: 2 } })
  m.chiudiSessione.mockResolvedValueOnce({ ok: false,motivo: 'ordini_dopo_conto',n: 1 })
  expect(await chiudiTavolo(id,'2026-10-11T19:00:00.000Z',false)).toMatchObject({ ok: false,avviso: { motivo: 'ordini_dopo_conto',n: 1 } })
  expect(await chiudiTavolo(id,'no',false)).toMatchObject({ ok: false })
  expect(await chiudiTavolo(id,null,'si' as unknown as boolean)).toMatchObject({ ok: false })
  m.chiudiSessione.mockResolvedValueOnce({ ok: true })
  expect(await chiudiTavolo(id,null,true)).toEqual({ ok: true })
  expect(m.chiudiSessione).toHaveBeenLastCalledWith(expect.anything(),id,null,true)
})
it('propaga i redirect di ruolo per tutte le azioni', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  for (const [azione,repo] of coppie) { await expect(azione(id)).rejects.toThrow('NEXT_REDIRECT'); expect(repo).not.toHaveBeenCalled() }
})
it('tutte le azioni restituiscono il messaggio italiano per errori DB', async () => {
  for (const [azione,repo] of coppie) { repo.mockRejectedValue(new Error('connessione')); expect(await azione(id)).toEqual({ ok: false, errore: 'Operazione non riuscita, riprova.' }) }
})
