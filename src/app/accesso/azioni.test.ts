import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ prenota: vi.fn(), annulla: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), leggiRuolo: vi.fn(), redirect: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/auth/tentativi-accesso-repo', () => ({ prenotaTentativoAccesso: m.prenota, annullaTentativoAccesso: m.annulla }))
vi.mock('@/auth/ruoli-repo', () => ({ leggiRuolo: m.leggiRuolo }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword: m.signIn, signOut: m.signOut } }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '192.0.2.1, 10.0.0.1' }) }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
import { chiaveEmail } from '@/domain/limiti-accesso'
import { entra, esci } from './azioni'

const ID = '11111111-1111-4111-8111-111111111111'
function modulo(email = 'Staff@Esempio.it', password = 'sbagliata', next = '') { const f = new FormData(); f.set('email',email); f.set('password',password); f.set('next',next); return f }
const prima = (a: ReturnType<typeof vi.fn>, b: ReturnType<typeof vi.fn>) => expect(a.mock.invocationCallOrder[0]).toBeLessThan(b.mock.invocationCallOrder[0])
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {})
  m.prenota.mockResolvedValue({ id: '7',errori: { email: 0,rete: 0 } })
  m.signIn.mockResolvedValue({ data: { user: null },error: { status: 400,code: 'invalid_credentials' } })
  m.redirect.mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT ${url}`) })
})

it('campi vuoti: nessun conteggio e nessuna chiamata a Supabase', async () => {
  expect(await entra({ errore: null },modulo('','x'))).toEqual({ errore: 'Inserisci email e password.' })
  expect(await entra({ errore: null },modulo('a@b.it',''))).toEqual({ errore: 'Inserisci email e password.' })
  expect(m.prenota).not.toHaveBeenCalled(); expect(m.signIn).not.toHaveBeenCalled()
})

it('registra il tentativo prima di Supabase, con email normalizzata e rete; se la password è sbagliata resta contato', async () => {
  expect(await entra({ errore: null },modulo())).toEqual({ errore: 'Email o password non corretti.' })
  expect(m.prenota).toHaveBeenCalledWith({},{ chiave: chiaveEmail('staff@esempio.it'),rete: '192.0.2.1',minuti: 15 })
  prima(m.prenota,m.signIn)
  expect(m.annulla).not.toHaveBeenCalled()
})

it.each([[{ email: 10,rete: 0 }],[{ email: 0,rete: 30 }]])('bloccato (%j): Supabase non viene chiamato e il tentativo non allunga il blocco', async errori => {
  m.prenota.mockResolvedValue({ id: '7',errori })
  const { errore } = await entra({ errore: null },modulo())
  expect(errore).toBe('Troppi tentativi di accesso: riprova tra qualche minuto.')
  expect(m.signIn).not.toHaveBeenCalled()
  expect(m.annulla).toHaveBeenCalledWith({},'7')
})

it('sotto i limiti (9 per email, 29 per rete) si prova ancora', async () => {
  m.prenota.mockResolvedValue({ id: '7',errori: { email: 9,rete: 29 } })
  expect((await entra({ errore: null },modulo())).errore).toBe('Email o password non corretti.')
  expect(m.signIn).toHaveBeenCalledTimes(1)
})

it.each([[429],[500],[0]])('guasto o limite di Supabase (stato %i): non conta come errore e il messaggio non parla di password', async status => {
  m.signIn.mockResolvedValue({ data: { user: null },error: { status } })
  expect((await entra({ errore: null },modulo())).errore).toContain('Accesso non riuscito')
  expect(m.annulla).toHaveBeenCalledWith({},'7')
})

it('credenziali giuste: il tentativo non conta, poi legge il ruolo e reindirizza', async () => {
  m.signIn.mockResolvedValue({ data: { user: { id: ID } },error: null })
  m.leggiRuolo.mockResolvedValue('staff')
  await expect(entra({ errore: null },modulo('a@b.it','giusta','/staff?vista=conti'))).rejects.toThrow('NEXT_REDIRECT /staff?vista=conti')
  prima(m.prenota,m.signIn); prima(m.signIn,m.annulla); prima(m.annulla,m.leggiRuolo)
  expect(m.redirect).toHaveBeenCalledTimes(1)
})

it('account senza ruolo: password giusta quindi non è un errore, ma esce subito', async () => {
  m.signIn.mockResolvedValue({ data: { user: { id: ID } },error: null })
  m.leggiRuolo.mockResolvedValue(null)
  expect((await entra({ errore: null },modulo())).errore).toContain('senza permessi')
  expect(m.annulla).toHaveBeenCalledTimes(1)
  expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(m.redirect).not.toHaveBeenCalled()
})

it('database giù: non si tenta il login (il limite non si aggira) e l’errore resta nei log', async () => {
  m.prenota.mockRejectedValue(new Error('connessione rifiutata'))
  expect((await entra({ errore: null },modulo())).errore).toContain('Accesso non riuscito')
  expect(m.signIn).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledWith('connessione rifiutata')
})

it('esci chiude la sessione su tutti i dispositivi e torna ad /accesso', async () => {
  m.signOut.mockResolvedValue({ error: null })
  await expect(esci()).rejects.toThrow(/^NEXT_REDIRECT \/accesso$/)
  expect(m.signOut).toHaveBeenCalledWith({ scope: 'global' })
  expect(console.error).not.toHaveBeenCalled()
})

it('esci: se la revoca non riesce lo dice, invece di far credere che le altre sessioni siano chiuse', async () => {
  m.signOut.mockResolvedValue({ error: { message: 'Supabase non risponde',status: 503 } })
  await expect(esci()).rejects.toThrow('NEXT_REDIRECT /accesso?errore=uscita')
  expect(console.error).toHaveBeenCalledWith('Supabase non risponde')
})
