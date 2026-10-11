import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ tavoloDaSlug: vi.fn(), elencoTavoli: vi.fn(), contaErrori: vi.fn(), verificaCodice: vi.fn(), registraTentativoFallito: vi.fn(), sessioneApertaPerId: vi.fn(), creaOrdineTavolo: vi.fn(), ordiniDellaSessione: vi.fn(), query: vi.fn(), get: vi.fn(), set: vi.fn(), redirect: vi.fn() }))
vi.mock('@/server/db', () => { const db = { query: m.query, transazione: async (fn: (tx: unknown) => unknown) => fn(db) }; return { db } })
vi.mock('@/tavoli/repo', () => ({ tavoloDaSlug: m.tavoloDaSlug, elencoTavoli: m.elencoTavoli, contaErrori: m.contaErrori, verificaCodice: m.verificaCodice, registraTentativoFallito: m.registraTentativoFallito, sessioneApertaPerId: m.sessioneApertaPerId }))
vi.mock('@/tavoli/ordini-repo', () => ({ creaOrdineTavolo: m.creaOrdineTavolo, ordiniDellaSessione: m.ordiniDellaSessione }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: m.get, set: m.set }) }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
import { entraAlTavolo, inviaOrdine, leggiOrdinatoFinora } from './azioni'
const id = '11111111-1111-4111-8111-111111111111'
const sessione = '22222222-2222-4222-8222-222222222222'
function fd(codice = '1234') { const f = new FormData(); f.set('codice',codice); return f }
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {})
  m.tavoloDaSlug.mockResolvedValue({ id, slug: 'uno' })
  m.elencoTavoli.mockResolvedValue([{ id, sessione: { id: sessione } }])
  m.get.mockReturnValue({ value: id }); m.contaErrori.mockResolvedValue({ dispositivo: 0, tavolo: 0 })
  m.verificaCodice.mockResolvedValue(null)
  m.redirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
  m.sessioneApertaPerId.mockResolvedValue({ id: sessione, tavoloSlug: 'uno', tavoloId: id })
})
it('invio: cookie mancante, sessione di altro tavolo, JSON rotto e carrello invalido', async () => {
  m.get.mockReturnValueOnce(undefined)
  expect((await inviaOrdine('uno','[]')).errore).toContain('chiuso')
  m.sessioneApertaPerId.mockResolvedValueOnce({ id: sessione, tavoloSlug: 'due' })
  expect((await inviaOrdine('uno','[]')).errore).toContain('chiuso')
  expect((await inviaOrdine('uno','{')).ok).toBe(false)
  expect((await inviaOrdine('uno','[]')).ok).toBe(false)
  expect(m.creaOrdineTavolo).not.toHaveBeenCalled()
})
it('invio valido restituisce numero e rifiuto mantiene i nomi esauriti', async () => {
  const json = JSON.stringify([{ piattoId: id, quantita: 1, nota: '', prezzoCent: 1 }])
  m.creaOrdineTavolo.mockResolvedValueOnce({ ok: true, ordine: { numero: 42 } })
  expect(await inviaOrdine('uno',json)).toEqual({ ok: true, numero: 42 })
  expect(m.creaOrdineTavolo.mock.calls[0][2][0]).not.toHaveProperty('prezzoCent')
  m.creaOrdineTavolo.mockResolvedValueOnce({ ok: false, errore: 'Esauriti', nonDisponibili: ['Salmone'] })
  expect(await inviaOrdine('uno',json)).toMatchObject({ ok: false, nonDisponibili: ['Salmone'] })
})
it('legge solo gli ordini della sessione autorizzata e serializza le date', async () => {
  m.ordiniDellaSessione.mockResolvedValueOnce([{ numero: 1, creatoIl: new Date('2026-10-11T12:00:00Z') }])
  expect(await leggiOrdinatoFinora('uno')).toEqual([{ numero: 1, creatoIl: '2026-10-11T12:00:00.000Z' }])
  m.sessioneApertaPerId.mockResolvedValueOnce(null)
  expect(await leggiOrdinatoFinora('uno')).toEqual([])
})
it('tavolo assente o chiuso non accetta codice', async () => {
  m.tavoloDaSlug.mockResolvedValueOnce(null)
  expect((await entraAlTavolo('uno',{ errore: null },fd())).errore).toBe('Tavolo non trovato')
  m.elencoTavoli.mockResolvedValueOnce([{ id, sessione: null }])
  expect((await entraAlTavolo('uno',{ errore: null },fd())).errore).toContain('non è ancora aperto')
})
it('blocca anche il codice giusto dopo cinque errori o trenta per tavolo', async () => {
  for (const errori of [{ dispositivo: 5, tavolo: 5 }, { dispositivo: 0, tavolo: 30 }]) {
    m.contaErrori.mockResolvedValueOnce(errori)
    expect((await entraAlTavolo('uno',{ errore: null },fd())).errore).toContain('Troppi tentativi')
  }
  expect(m.verificaCodice).not.toHaveBeenCalled(); expect(m.redirect).not.toHaveBeenCalled()
})
it('registra errore per codice malformato e sbagliato', async () => {
  for (const codice of ['abcd','0000']) expect((await entraAlTavolo('uno',{ errore: null },fd(codice))).errore).toBe('Codice non corretto')
  expect(m.registraTentativoFallito).toHaveBeenCalledTimes(2)
  expect(m.redirect).not.toHaveBeenCalled()
})
it('normalizza, imposta cookie protetto e propaga redirect solo col codice corretto', async () => {
  m.verificaCodice.mockResolvedValueOnce({ id: sessione })
  await expect(entraAlTavolo('uno',{ errore: null },fd(' 12 34 '))).rejects.toThrow('NEXT_REDIRECT')
  expect(m.verificaCodice).toHaveBeenCalledWith(expect.anything(),id,'1234')
  expect(m.set).toHaveBeenCalledWith('ds_tavolo_uno',sessione,expect.objectContaining({ httpOnly: true, path: '/tavolo/uno', maxAge: 43200 }))
})
it('genera un dispositivo se il cookie manca e restituisce errori DB italiani', async () => {
  m.get.mockReturnValueOnce(undefined)
  await entraAlTavolo('uno',{ errore: null },fd())
  expect(m.set).toHaveBeenCalledWith('ds_dispositivo',expect.stringMatching(/^[0-9a-f-]{36}$/),expect.objectContaining({ httpOnly: true }))
  m.tavoloDaSlug.mockRejectedValueOnce(new Error('connessione'))
  expect((await entraAlTavolo('uno',{ errore: null },fd())).errore).toContain('riprova')
})
