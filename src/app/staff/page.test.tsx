import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const m = vi.hoisted(() => ({ ruolo: vi.fn(),elenco: vi.fn(),ordini: vi.fn(),riepiloghi: vi.fn(),conti: vi.fn(),casa: vi.fn(),disponibilita: vi.fn(),email: vi.fn(),cookie: vi.fn(),attive: vi.fn(),portare: vi.fn(),riepilogo: vi.fn(),menu: vi.fn() }))
vi.mock('next/headers',() => ({ cookies: async () => ({ get: (nome: string) => nome === 'ds_postazione' && m.cookie() ? { value: m.cookie() } : undefined }) }))
vi.mock('@/comande/comande-repo',() => ({ comandeAttive: m.attive,daPortare: m.portare,riepilogoComande: m.riepilogo,comandaPerClient: (c: object) => c }))
vi.mock('@/menu/repo',() => ({ leggiMenu: m.menu }))
vi.mock('./azioni-postazione',() => ({ impostaPostazione: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.ruolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('@/tavoli/repo',() => ({ elencoTavoli: m.elenco,contiRecenti: m.conti }))
vi.mock('@/tavoli/ordini-repo',() => ({ ordiniAttivi: m.ordini,riepiloghiTavoli: m.riepiloghi }))
vi.mock('@/app/accesso/azioni',() => ({ esci: vi.fn() }))
vi.mock('@/casa/ordini-casa-repo',() => ({ ordiniCasaAttivi: m.casa,perClient: (o: object) => o }))
vi.mock('@/casa/disponibilita',() => ({ leggiDisponibilita: m.disponibilita }))
vi.mock('@/casa/avvia-email',() => ({ avviaInvioEmail: m.email }))
vi.mock('next/navigation',async originale => ({ ...await originale<typeof import('next/navigation')>(),useRouter: () => ({ refresh: vi.fn() }) }))
import { redirect } from 'next/navigation'
import AreaStaff from './page'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.elenco.mockResolvedValue([]); m.ordini.mockResolvedValue([]); m.riepiloghi.mockResolvedValue([]); m.conti.mockResolvedValue([]); m.casa.mockResolvedValue([])
  m.attive.mockResolvedValue([]); m.portare.mockResolvedValue([]); m.riepilogo.mockResolvedValue(new Map())
  m.disponibilita.mockResolvedValue({ oggi: '2026-10-12',apertiIl: '2026-10-12',servizi: { asporto: { apertura: { aperto: true } },domicilio: { apertura: { aperto: false,motivo: 'zone' } } } }) })
it('mantiene intestazione e tentativi automatici se falliscono le letture DB', async () => {
  m.elenco.mockRejectedValueOnce(new Error('DB giù'))
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).toContain('Area staff'); expect(html).toContain('Database non raggiungibile, riprovo da solo')
  // InizioTurno resta montato anche quando la lettura fallisce.
  expect(html).toContain('Inizia turno')
})
it('con i dati letti non mostra il banner di errore', async () => {
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).not.toContain('Database non raggiungibile'); expect(html).toContain('Inizia turno')
  // Lo schermo ritenta le email in coda a ogni aggiornamento riuscito.
  expect(m.email).toHaveBeenCalledTimes(1)
})
it('i redirect del ruolo propagano senza essere convertiti in errori DB', async () => {
  m.ruolo.mockImplementationOnce(async () => redirect('/accesso'))
  await expect(AreaStaff()).rejects.toThrow('NEXT_REDIRECT')
  expect(m.elenco).not.toHaveBeenCalled()
})
it('se il DB non risponde nemmeno per il ruolo resta lo schermo, senza leggere dati', async () => {
  m.ruolo.mockRejectedValueOnce(new Error('DB giù'))
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).toContain('Database non raggiungibile, riprovo da solo'); expect(html).toContain('Inizia turno')
  expect(m.elenco).not.toHaveBeenCalled()
})
it('banco dal cookie: legge solo le sue comande, niente tavoli né ordini da casa', async () => {
  m.cookie.mockReturnValue('banco')
  const html = renderToStaticMarkup(await AreaStaff())
  expect(m.attive).toHaveBeenCalledWith({},'banco')
  for (const f of [m.elenco,m.ordini,m.casa,m.disponibilita,m.portare]) expect(f).not.toHaveBeenCalled()
  expect(m.email).toHaveBeenCalledTimes(1)
  expect(html).toMatch(/value="banco"[^>]*checked=""|checked=""[^>]*value="banco"/)
})
it('la query vince sul cookie; il ruolo si verifica prima di leggere', async () => {
  m.cookie.mockReturnValue('banco')
  await AreaStaff({ searchParams: Promise.resolve({ postazione: 'cucina' }) })
  expect(m.attive).toHaveBeenCalledWith({},'cucina')
  expect(m.ruolo.mock.invocationCallOrder[0]).toBeLessThan(m.attive.mock.invocationCallOrder[0])
})
it('cassa: ordini, striscia «Da portare» e stato delle comande', async () => {
  m.ordini.mockResolvedValue([{ id: 'o1',creatoIl: new Date('2026-10-11T18:00:00Z') }])
  await AreaStaff()
  expect(m.portare).toHaveBeenCalled(); expect(m.riepilogo).toHaveBeenCalledWith({},['o1']); expect(m.attive).not.toHaveBeenCalled()
})
