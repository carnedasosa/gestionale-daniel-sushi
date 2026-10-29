import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), apriSessione: vi.fn(), chiudiSessione: vi.fn(), sbloccaSessione: vi.fn(), impostaCoperti: vi.fn(), avanzaStato: vi.fn(), annullaOrdine: vi.fn(), annullaRiga: vi.fn(), annullaVoceConto: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/tavoli/repo', () => ({ apriSessione: m.apriSessione, chiudiSessione: m.chiudiSessione, sbloccaSessione: m.sbloccaSessione, impostaCoperti: m.impostaCoperti }))
vi.mock('@/tavoli/ordini-repo', () => ({ avanzaStato: m.avanzaStato, annullaOrdine: m.annullaOrdine, annullaRiga: m.annullaRiga, annullaVoceConto: m.annullaVoceConto }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { apriTavolo, cambiaCoperti, chiudiTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, annullaVoceStaff } from './azioni'
const id = '11111111-1111-4111-8111-111111111111'
const avanzaDaInviato = (ordineId: string) => avanzaOrdine(ordineId,'inviato')
const coppie = [[apriTavolo,m.apriSessione],[chiudiTavolo,m.chiudiSessione],[sbloccaTavolo,m.sbloccaSessione],[avanzaDaInviato,m.avanzaStato],[annullaOrdineStaff,m.annullaOrdine],[annullaRigaStaff,m.annullaRiga]] as const
const utente = '22222222-2222-4222-8222-222222222222'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: utente,ruolo: 'staff' }) })
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
it('avanza passando lo stato visto sulla card e spiega quando un altro schermo è arrivato prima', async () => {
  m.avanzaStato.mockResolvedValueOnce({ id })
  expect(await avanzaOrdine(id,'in_preparazione')).toEqual({ ok: true })
  expect(m.avanzaStato).toHaveBeenLastCalledWith(expect.anything(),id,'in_preparazione')
  m.avanzaStato.mockResolvedValueOnce(null)
  expect(await avanzaOrdine(id,'inviato')).toEqual({ ok: false,errore: 'La comanda è già stata aggiornata da un altro schermo: controlla il suo stato attuale.' })
  m.avanzaStato.mockClear()
  for (const da of ['servito','annullato','boh',undefined]) expect((await avanzaOrdine(id,da as never)).ok).toBe(false)
  expect(m.avanzaStato).not.toHaveBeenCalled()
})
it('gli annullamenti registrano l’utente staff e rifiutano i conti chiusi con un messaggio chiaro', async () => {
  const voce = { nome: 'Salmone',numero: 1,prezzoUnitCent: 600,poke: null }
  for (const [chiama,repo,args] of [[() => annullaOrdineStaff(id),m.annullaOrdine,[id,utente]],[() => annullaRigaStaff(id),m.annullaRiga,[id,utente]],[() => annullaVoceStaff(id,voce),m.annullaVoceConto,[id,voce,utente]]] as const) {
    repo.mockResolvedValueOnce('ok')
    expect(await chiama()).toEqual({ ok: true })
    expect(repo).toHaveBeenLastCalledWith(expect.anything(),...args)
    repo.mockResolvedValueOnce('conto_chiuso')
    expect(await chiama()).toEqual({ ok: false,errore: 'Il conto di questo tavolo è già chiuso: non si può più modificare.' })
    repo.mockResolvedValueOnce('non_disponibile')
    expect(await chiama()).toEqual({ ok: false,errore: 'Operazione non disponibile: aggiorna lo schermo.' })
  }
})
it('una riga di un ordine da casa già completato si rifiuta con un messaggio che non parla di tavolo', async () => {
  m.annullaRiga.mockResolvedValueOnce('ordine_concluso')
  expect(await annullaRigaStaff(id)).toEqual({ ok: false,errore: 'L’ordine è già completato: non si può più modificare.' })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.annullaRiga.mock.invocationCallOrder[0])
  expect(m.revalidatePath).not.toHaveBeenCalled()
})
it('coperti: staff prima del repo, solo da 1 a 99 o null, conto chiuso spiegato', async () => {
  m.impostaCoperti.mockResolvedValueOnce('ok')
  expect(await cambiaCoperti(id,4)).toEqual({ ok: true })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.impostaCoperti.mock.invocationCallOrder[0])
  expect(m.impostaCoperti).toHaveBeenLastCalledWith(expect.anything(),id,4)
  m.impostaCoperti.mockResolvedValueOnce('ok')
  expect(await cambiaCoperti(id,null)).toEqual({ ok: true })
  m.impostaCoperti.mockClear()
  for (const n of [0,100,2.5,'3' as unknown as number]) expect(await cambiaCoperti(id,n)).toMatchObject({ ok: false })
  expect(await cambiaCoperti('x',2)).toMatchObject({ ok: false })
  expect(m.impostaCoperti).not.toHaveBeenCalled()
  m.impostaCoperti.mockResolvedValueOnce('conto_chiuso')
  expect(await cambiaCoperti(id,2)).toMatchObject({ ok: false,errore: expect.stringContaining('già chiuso') })
})
