import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), elencoTavoli: vi.fn(), creaTavolo: vi.fn(), aggiornaTavolo: vi.fn(), rigeneraChiave: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/tavoli/repo', () => ({ elencoTavoli: m.elencoTavoli, creaTavolo: m.creaTavolo, aggiornaTavolo: m.aggiornaTavolo, rigeneraChiave: m.rigeneraChiave }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { aggiungiTavolo, salvaTavolo, nuovoQr, type StatoTavolo } from './azioni'
const id = '11111111-1111-4111-8111-111111111111'
const stato: StatoTavolo = { errore: null, salvato: false, valori: null, invii: 0 }
it('nuovo QR richiede admin, valida ID e rivalida gli URL', async () => {
  m.rigeneraChiave.mockResolvedValueOnce({ id,chiave: 'abcdefghijkl' })
  expect(await nuovoQr(id)).toEqual({ ok: true })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.rigeneraChiave.mock.invocationCallOrder[0])
  expect(await nuovoQr('x')).toMatchObject({ ok: false })
  expect(m.rigeneraChiave).toHaveBeenCalledTimes(1)
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(nuovoQr(id)).rejects.toThrow('NEXT_REDIRECT')
})
function fd(nome = 'Tavolo 1') { const f = new FormData(); f.set('nome',nome); f.set('posizione','0'); f.set('attivo','on'); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.elencoTavoli.mockResolvedValue([]); m.creaTavolo.mockResolvedValue({ id }); m.aggiornaTavolo.mockResolvedValue({ id }) })
it('admin prima di tutto, nomi validati e slug univoci', async () => {
  m.elencoTavoli.mockResolvedValueOnce([{ slug: 'tavolo-1' }])
  expect((await aggiungiTavolo(stato,fd())).salvato).toBe(true)
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.elencoTavoli.mock.invocationCallOrder[0])
  expect(m.creaTavolo).toHaveBeenCalledWith(expect.anything(),'Tavolo 1','tavolo-1-2')
  m.creaTavolo.mockClear()
  for (const nome of ['', 'x'.repeat(41)]) expect((await aggiungiTavolo(stato,fd(nome))).errore).toBeTruthy()
  expect(m.creaTavolo).not.toHaveBeenCalled()
})
it('non disattiva un tavolo aperto e valida id, posizione e booleano form', async () => {
  const f = fd(); f.delete('attivo')
  m.elencoTavoli.mockResolvedValueOnce([{ id, sessione: { id } }])
  expect((await salvaTavolo(id,stato,f)).errore).toBe('Chiudi prima il tavolo dallo schermo staff')
  expect((await salvaTavolo('x',stato,f)).errore).toBeTruthy()
  f.set('posizione','1.2'); expect((await salvaTavolo(id,stato,f)).errore).toBeTruthy()
  f.set('posizione','0'); f.set('attivo','falso'); expect((await salvaTavolo(id,stato,f)).errore).toBeTruthy()
  expect(m.aggiornaTavolo).not.toHaveBeenCalled()
})
it('propaga ruolo, gestisce DB e preserva valori', async () => {
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(aggiungiTavolo(stato,fd())).rejects.toThrow('NEXT_REDIRECT')
  m.creaTavolo.mockRejectedValueOnce(new Error('connessione'))
  const s = await aggiungiTavolo(stato,fd())
  expect(s.errore).toBeTruthy(); expect(s.valori?.nome).toBe('Tavolo 1'); expect(s.invii).toBe(1)
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(salvaTavolo(id,stato,fd())).rejects.toThrow('NEXT_REDIRECT')
})
