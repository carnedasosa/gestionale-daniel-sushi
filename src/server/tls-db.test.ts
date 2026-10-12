import { X509Certificate } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CA_SUPABASE_2021 } from './ca-supabase'
import { opzioniTls } from './tls-db'

const POOLER = 'postgresql://postgres.abc:segreta@aws-1-eu-central-1.pooler.supabase.com:6543/postgres'
describe('opzioniTls', () => {
  it('in locale (PGlite e server finti) nessun TLS', () => {
    expect(opzioniTls('postgresql://postgres:postgres@127.0.0.1:5432/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@localhost:55432/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@LOCALHOST/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@[::1]:5432/postgres')).toBe(false)
  })
  it('ogni altro host: TLS con la CA di Supabase e certificato verificato', () => {
    expect(opzioniTls(POOLER)).toEqual({ ca: CA_SUPABASE_2021,rejectUnauthorized: true })
    expect(opzioniTls('postgresql://u:p@db.esempio.it/postgres')).toEqual({ ca: CA_SUPABASE_2021,rejectUnauthorized: true })
  })
  it('rifiuta i parametri TLS nell’URL, che in pg sostituirebbero la verifica', () => {
    for (const parametro of ['sslmode=require','sslmode=disable','ssl=true','sslrootcert=system','uselibpqcompat=true'])
      expect(() => opzioniTls(`${POOLER}?${parametro}`),parametro).toThrow(/DATABASE_URL/)
    expect(() => opzioniTls(`${POOLER}?application_name=gestionale`)).not.toThrow()
  })
  it('URL non valido: errore che non mostra la password', () => {
    expect(() => opzioniTls('non è un url segreta')).toThrow(/DATABASE_URL/)
    try { opzioniTls('non è un url segreta') } catch (e) { expect(String(e)).not.toContain('segreta') }
  })
})
describe('CA di Supabase', () => {
  it('è la «Supabase Root 2021 CA» attesa', () => {
    const ca = new X509Certificate(CA_SUPABASE_2021)
    expect(ca.subject).toContain('CN=Supabase Root 2021 CA')
    expect(ca.fingerprint256).toBe('80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA')
    expect(ca.ca).toBe(true)
  })
})
