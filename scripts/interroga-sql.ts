// Uso: npx tsx --env-file=.env.local scripts/interroga-sql.ts percorso.sql
// Esegue in sola lettura (transazione read only) le interrogazioni di un file SQL sul database di DATABASE_URL e stampa le righe.
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { opzioniTls } from '../src/server/tls-db'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante')
  const client = new pg.Client({ connectionString: url,ssl: opzioniTls(url),connectionTimeoutMillis: 15_000 })
  await client.connect()
  try {
    await client.query('begin read only')
    for (const sql of readFileSync(process.argv[2],'utf8').split(';').map(s => s.trim()).filter(Boolean)) {
      const { rows } = await client.query(sql)
      console.log(`-- ${sql.split('\n')[0]}`); console.table(rows)
    }
    await client.query('rollback')
  } finally { await client.end() }
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
