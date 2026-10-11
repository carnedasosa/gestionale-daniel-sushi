import { PGlite, type Transaction } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Db } from '@/server/db-tipi'

// Quello che Supabase ha già e PGlite no: schema auth, auth.uid() e i ruoli dell'API.
const STUB_SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key, email text unique);
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`

export async function creaDbDiTest(opzioni: { seed?: boolean } = {}): Promise<{ pg: PGlite; db: Db }> {
  const pg = new PGlite()
  await pg.exec(STUB_SUPABASE)
  const cartella = path.resolve('supabase/migrations')
  for (const file of readdirSync(cartella).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(path.join(cartella, file), 'utf8'))
  }
  if (opzioni.seed) await pg.exec(readFileSync('supabase/seed.sql', 'utf8'))
  const adatta = (client: PGlite | Transaction): Db => ({
    async query<T>(text: string, params: unknown[] = []) { return (await client.query<T>(text,params as never[])).rows },
    async transazione<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if ('transaction' in client) return client.transaction(tx => fn(adatta(tx)))
      await client.query('savepoint sotto_transazione')
      try {
        const risultato = await fn(adatta(client))
        await client.query('release savepoint sotto_transazione')
        return risultato
      } catch (err) {
        await client.query('rollback to savepoint sotto_transazione')
        throw err
      }
    },
  })
  const db = adatta(pg)
  return { pg, db }
}
