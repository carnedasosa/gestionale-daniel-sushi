import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), revalidatePath: vi.fn(), salvaImpostazioni: vi.fn(), creaZona: vi.fn(), salvaZona: vi.fn(), aggiungiOrario: vi.fn(), rimuoviOrario: vi.fn(), aggiungiChiusura: vi.fn(), rimuoviChiusura: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/casa/impostazioni-repo', () => ({ salvaImpostazioni: m.salvaImpostazioni, creaZona: m.creaZona, salvaZona: m.salvaZona, aggiungiOrario: m.aggiungiOrario, rimuoviOrario: m.rimuoviOrario, aggiungiChiusura: m.aggiungiChiusura, rimuoviChiusura: m.rimuoviChiusura }))
import { aggiungiChiusuraCasa, aggiungiOrarioCasa, rimuoviChiusuraCasa, rimuoviOrarioCasa, salvaImpostazioniCasa, salvaZonaCasa, type StatoModulo } from './azioni'
const stato: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const id = '11111111-1111-4111-8111-111111111111'
const fd = (v: Record<string,string>) => { const f = new FormData(); for (const [k,x] of Object.entries(v)) f.set(k,x); f.set('$ACTION_ID_abc',''); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.salvaZona.mockResolvedValue(true); m.rimuoviOrario.mockResolvedValue(true); m.rimuoviChiusura.mockResolvedValue(true) })
it('impostazioni: admin prima del salvataggio, valori convertiti e pagine rivalidate', async () => {
  expect(await salvaImpostazioniCasa(stato,fd({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '080 1234567' }))).toEqual({ errore: null,salvato: true,valori: null,invii: 1 })
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.salvaImpostazioni.mock.invocationCallOrder[0])
  expect(m.salvaImpostazioni).toHaveBeenCalledWith({},{ capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' })
  expect(m.revalidatePath).toHaveBeenCalledWith('/admin/domicilio'); expect(m.revalidatePath).toHaveBeenCalledWith('/ordina')
})
it('un errore del controllo conserva i valori inseriti, senza le chiavi interne di Next', async () => {
  const s = await salvaImpostazioniCasa(stato,fd({ capacitaFascia: '4',capacitaConsegne: '9',anticipoMinuti: '30',telefono: '' }))
  expect(s).toMatchObject({ salvato: false,errore: expect.stringContaining('Consegne'),invii: 1 })
  expect(s.valori).toEqual({ capacitaFascia: '4',capacitaConsegne: '9',anticipoMinuti: '30',telefono: '' })
  expect(m.salvaImpostazioni).not.toHaveBeenCalled()
})
it('zone: crea senza id, modifica con id valido, rifiuta id non validi', async () => {
  const z = { nome: 'Bitetto',costo: '2',minimo: '15',posizione: '0',attiva: 'on' }
  expect((await salvaZonaCasa(null,stato,fd(z))).salvato).toBe(true); expect(m.creaZona).toHaveBeenCalled()
  expect((await salvaZonaCasa(id,stato,fd(z))).salvato).toBe(true); expect(m.salvaZona).toHaveBeenCalledWith({},id,expect.objectContaining({ nome: 'Bitetto' }))
  expect((await salvaZonaCasa('x',stato,fd(z))).salvato).toBe(false)
  m.salvaZona.mockResolvedValueOnce(false)
  expect((await salvaZonaCasa(id,stato,fd(z))).errore).toContain('Salvataggio non riuscito')
})
it('orari e chiusure: aggiunta e rimozione', async () => {
  expect((await aggiungiOrarioCasa(stato,fd({ servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00' }))).salvato).toBe(true)
  expect((await aggiungiChiusuraCasa(stato,fd({ data: '2026-12-25',motivo: 'Natale' }))).salvato).toBe(true)
  expect(m.aggiungiChiusura).toHaveBeenCalledWith({},'2026-12-25','Natale')
  expect(await rimuoviOrarioCasa(id)).toEqual({ ok: true })
  expect(await rimuoviOrarioCasa('x')).toMatchObject({ ok: false }); expect(m.rimuoviOrario).toHaveBeenCalledTimes(1)
  m.rimuoviChiusura.mockResolvedValueOnce(false)
  expect(await rimuoviChiusuraCasa('2026-12-25')).toMatchObject({ ok: false,errore: expect.stringContaining('Già rimosso') })
  expect(await rimuoviChiusuraCasa('domani')).toMatchObject({ ok: false })
})
it('redirect di ruolo propagati ed errori del DB in italiano', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(salvaImpostazioniCasa(stato,fd({}))).rejects.toThrow('NEXT_REDIRECT')
  await expect(rimuoviOrarioCasa(id)).rejects.toThrow('NEXT_REDIRECT')
  m.richiediRuolo.mockResolvedValue(undefined)
  m.rimuoviOrario.mockRejectedValueOnce(new Error('connessione'))
  expect(await rimuoviOrarioCasa(id)).toEqual({ ok: false,errore: 'Operazione non riuscita, riprova.' })
})
