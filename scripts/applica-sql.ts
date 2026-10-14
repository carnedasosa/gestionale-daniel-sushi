// Uso: npx tsx --env-file=.env.local scripts/applica-sql.ts percorso.sql
// Esegue un file SQL sul database di DATABASE_URL (connessione cifrata come l'app) e stampa un riepilogo.
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { opzioniTls } from '../src/server/tls-db'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante')
  const client = new pg.Client({ connectionString: url,ssl: opzioniTls(url),connectionTimeoutMillis: 15_000 })
  await client.connect()
  try { await client.query(readFileSync(process.argv[2],'utf8')) } finally { await client.end() }
  console.log(`Eseguito ${process.argv[2]}`)
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
