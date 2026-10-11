import { PGlite } from '@electric-sql/pglite'
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
  const db: Db = {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params as never[])
      return res.rows
    },
  }
  return { pg, db }
}
