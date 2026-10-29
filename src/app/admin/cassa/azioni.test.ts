import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), salvaImpostazioniCassa: vi.fn(), revalidatePath: vi.fn(), salvaImpostazioniFiscali: vi.fn(), repartiFiscaliCategorie: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/cassa/impostazioni-repo', () => ({ salvaImpostazioniCassa: m.salvaImpostazioniCassa }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/fiscale/scontrini-repo', () => ({ salvaImpostazioniFiscali: m.salvaImpostazioniFiscali,repartiFiscaliCategorie: m.repartiFiscaliCategorie }))
import { salvaCassa, salvaFiscale } from './azioni'
const INIZIALE = { errore: null,salvato: false,valori: null,invii: 0 }
const fd = (o: Record<string,string>) => { const f = new FormData(); for (const [k,v] of Object.entries(o)) f.set(k,v); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: 'u',ruolo: 'admin' }) })
it('admin prima del salvataggio, poi rivalida', async () => {
  expect(await salvaCassa(INIZIALE,fd({ coperto: '2,00' }))).toMatchObject({ salvato: true,errore: null,invii: 1 })
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.salvaImpostazioniCassa.mock.invocationCallOrder[0])
  expect(m.salvaImpostazioniCassa).toHaveBeenCalledWith(expect.anything(),{ copertoCent: 200,stampa: { banco: false,cucina: false,sala: false } })
  expect(m.revalidatePath).toHaveBeenCalledWith('/admin/cassa')
})
it('valori sbagliati ed errori del DB tornano nel modulo', async () => {
  expect(await salvaCassa(INIZIALE,fd({ coperto: 'tanti' }))).toMatchObject({ salvato: false,valori: { coperto: 'tanti' } })
  expect(m.salvaImpostazioniCassa).not.toHaveBeenCalled()
  m.salvaImpostazioniCassa.mockRejectedValueOnce(new Error('giù'))
  expect(await salvaCassa(INIZIALE,fd({ coperto: '1' }))).toMatchObject({ salvato: false,errore: expect.stringContaining('Salvataggio non riuscito') })
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(salvaCassa(INIZIALE,fd({ coperto: '1' }))).rejects.toThrow('NEXT_REDIRECT')
})
it('registratore: admin prima, categorie dal DB, errori nel modulo', async () => {
  m.repartiFiscaliCategorie.mockResolvedValue([{ id: 'sushi',nome: 'Sushi',repartoFiscale: 1 }])
  expect(await salvaFiscale(INIZIALE,fd({ repartoCoperto: '1',repartoConsegna: '1',indiceCarta: '1','reparto:sushi': '2' }))).toMatchObject({ salvato: true })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.repartiFiscaliCategorie.mock.invocationCallOrder[0])
  expect(m.salvaImpostazioniFiscali).toHaveBeenCalledWith(expect.anything(),{ repartoCoperto: 1,repartoConsegna: 1,indiceCarta: 1,automatico: false },{ sushi: 2 })
  expect(await salvaFiscale(INIZIALE,fd({ repartoCoperto: '1',repartoConsegna: '1',indiceCarta: '1' }))).toMatchObject({ salvato: false,errore: expect.stringContaining('categoria') })
  m.salvaImpostazioniFiscali.mockRejectedValueOnce(new Error('giù'))
  expect(await salvaFiscale(INIZIALE,fd({ repartoCoperto: '1',repartoConsegna: '1',indiceCarta: '1','reparto:sushi': '1' }))).toMatchObject({ salvato: false,errore: expect.stringContaining('Salvataggio') })
})
