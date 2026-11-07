import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
// Niente mock di @supabase/ssr: gira la libreria vera e si finge solo la rete, così si controllano i cookie che escono davvero.
const m = vi.hoisted(() => ({ salvati: [] as { name: string; value: string; options: Record<string,unknown> }[] }))
// Come in una Server Action, getAll vede subito ciò che set ha appena scritto.
vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [...new Map(m.salvati.map(c => [c.name,c])).values()].filter(c => c.options.maxAge !== 0).map(({ name,value }) => ({ name,value })),
  set: (name: string, value: string, options: Record<string,unknown>) => { m.salvati.push({ name,value,options }) },
}) }))
import { createClient } from './server'
import { updateSession } from './proxy'

const NOME = 'sb-prova-auth-token'
const b64 = (x: unknown) => Buffer.from(JSON.stringify(x)).toString('base64url')
const utente = { id: '11111111-1111-4111-8111-111111111111',aud: 'authenticated',email: 'staff@esempio.it',app_metadata: {},user_metadata: {},created_at: '2026-01-01T00:00:00Z' }
function sessione(scadenza: number, refresh: string) {
  const accessToken = `${b64({ alg: 'HS256',typ: 'JWT' })}.${b64({ sub: utente.id,exp: scadenza,iat: scadenza - 3600,aud: 'authenticated',role: 'authenticated',session_id: 's' })}.${b64('firma')}`
  return { access_token: accessToken,refresh_token: refresh,token_type: 'bearer',expires_in: 3600,expires_at: scadenza,user: utente }
}
const ora = () => Math.floor(Date.now() / 1000)
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo),{ status,headers: { 'Content-Type': 'application/json' } })

let chiamate: string[]
function fingiRete(rispondi: (url: URL) => Response) {
  vi.stubGlobal('fetch',vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input)
    chiamate.push(`${url.pathname}${url.search}`)
    return rispondi(url)
  }))
}
beforeEach(() => {
  m.salvati.length = 0; chiamate = []
  vi.stubEnv('SUPABASE_URL','https://prova.supabase.co'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','chiave-pubblica')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('login: la sessione finisce in un cookie httpOnly e lax, secure solo in produzione', async () => {
  fingiRete(() => json(sessione(ora() + 3600,'r1')))
  for (const [ambiente,secure] of [['test',false],['production',true]] as const) {
    vi.stubEnv('NODE_ENV',ambiente); m.salvati.length = 0
    const { data,error } = await (await createClient()).auth.signInWithPassword({ email: utente.email,password: 'segreta' })
    expect(error).toBeNull(); expect(data.user?.id).toBe(utente.id)
    const cookie = m.salvati.find(c => c.name === NOME)
    expect(cookie?.value).toMatch(/^base64-/)
    expect(cookie?.options).toMatchObject({ httpOnly: true,secure,sameSite: 'lax',path: '/' })
  }
  expect(chiamate[0]).toContain('/auth/v1/token?grant_type=password')
})

it('login seguito da uscita locale sullo stesso client: il cookie appena scritto viene cancellato', async () => {
  fingiRete(url => url.pathname === '/auth/v1/logout' ? new Response(null,{ status: 204 }) : json(sessione(ora() + 3600,'r1')))
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email: utente.email,password: 'segreta' })
  expect(m.salvati.filter(c => c.name === NOME).at(-1)?.options.maxAge).toBeGreaterThan(0)
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  expect(error).toBeNull()
  expect(m.salvati.filter(c => c.name === NOME).at(-1)).toMatchObject({ value: '',options: { maxAge: 0 } })
})

function richiesta(percorso: string, cookie?: string) {
  return new NextRequest(`http://localhost${percorso}`,{ headers: cookie ? { cookie } : {} })
}
const cookieDi = (s: unknown) => `${NOME}=base64-${Buffer.from(JSON.stringify(s)).toString('base64url')}`

it('proxy: rinnova una sessione scaduta e riscrive il cookie httpOnly, facendo passare la richiesta', async () => {
  vi.stubEnv('NODE_ENV','production')
  const nuova = sessione(ora() + 3600,'r2')
  fingiRete(url => url.pathname === '/auth/v1/token' ? json(nuova) : json(utente))
  const risposta = await updateSession(richiesta('/staff',cookieDi(sessione(ora() - 60,'r1'))))
  expect(chiamate).toContain('/auth/v1/token?grant_type=refresh_token')
  expect(risposta.headers.get('location')).toBeNull()
  expect(risposta.status).toBe(200)
  const scritto = risposta.cookies.get(NOME)
  expect(Buffer.from(scritto!.value.replace(/^base64-/,''),'base64url').toString()).toContain('"refresh_token":"r2"')
  expect(scritto).toMatchObject({ httpOnly: true,secure: true,sameSite: 'lax',path: '/' })
})

it('proxy: una sessione valida passa senza rinnovi e senza riscrivere i cookie', async () => {
  fingiRete(() => json(utente))
  const risposta = await updateSession(richiesta('/admin',cookieDi(sessione(ora() + 3600,'r1'))))
  expect(risposta.status).toBe(200)
  expect(chiamate.filter(c => c.startsWith('/auth/v1/token'))).toEqual([])
  expect(risposta.cookies.get(NOME)).toBeUndefined()
})

it('proxy: senza sessione rimanda ad /accesso ricordando la pagina, senza chiamare Supabase', async () => {
  fingiRete(() => json({},500))
  const risposta = await updateSession(richiesta('/staff?vista=conti'))
  expect(new URL(risposta.headers.get('location')!).pathname + new URL(risposta.headers.get('location')!).search).toBe(`/accesso?next=${encodeURIComponent('/staff?vista=conti')}`)
  expect(chiamate).toEqual([])
})
