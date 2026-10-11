import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), apriSessione: vi.fn(), chiudiSessione: vi.fn(), avanzaStato: vi.fn(), annullaOrdine: vi.fn(), annullaRiga: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/tavoli/repo', () => ({ apriSessione: m.apriSessione, chiudiSessione: m.chiudiSessione }))
vi.mock('@/tavoli/ordini-repo', () => ({ avanzaStato: m.avanzaStato, annullaOrdine: m.annullaOrdine, annullaRiga: m.annullaRiga }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { apriTavolo, chiudiTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff } from './azioni'
const id = '11111111-1111-4111-8111-111111111111'
const coppie = [[apriTavolo,m.apriSessione],[chiudiTavolo,m.chiudiSessione],[avanzaOrdine,m.avanzaStato],[annullaOrdineStaff,m.annullaOrdine],[annullaRigaStaff,m.annullaRiga]] as const
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })
it('ogni azione verifica staff prima del repo, valida id e rivalida dopo successo', async () => {
  for (const [azione,repo] of coppie) {
    repo.mockResolvedValue({ id,codice: '1234' })
    expect((await azione(id)).ok).toBe(true)
    expect(m.richiediRuolo).toHaveBeenLastCalledWith('staff')
    expect(m.richiediRuolo.mock.invocationCallOrder.at(-1)!).toBeLessThan(repo.mock.invocationCallOrder.at(-1)!)
    expect(m.revalidatePath).toHaveBeenCalledWith('/staff')
    repo.mockClear()
    expect((await azione('x')).ok).toBe(false); expect(repo).not.toHaveBeenCalled()
  }
})
it('propaga i redirect di ruolo per tutte le azioni', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  for (const [azione,repo] of coppie) { await expect(azione(id)).rejects.toThrow('NEXT_REDIRECT'); expect(repo).not.toHaveBeenCalled() }
})
it('tutte le azioni restituiscono il messaggio italiano per errori DB', async () => {
  for (const [azione,repo] of coppie) { repo.mockRejectedValue(new Error('connessione')); expect(await azione(id)).toEqual({ ok: false, errore: 'Operazione non riuscita, riprova.' }) }
})
