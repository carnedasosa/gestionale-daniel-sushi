// Uso: npx tsx --env-file=.env.local scripts/interroga-sql.ts percorso.sql
// Esegue in sola lettura (transazione read only) le interrogazioni di un file SQL sul database di DATABASE_URL e stampa le righe.
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { opzioniTls } from '../src/server/tls-db'

/**
 * Spezza il file sui punti e virgola, senza capire stringhe o commenti: niente punti e virgola lì dentro.
 * Scarta i pezzi fatti solo di commenti (per esempio un'intestazione chiusa da un punto e virgola).
 */
export function spezzaSql(testo: string): string[] {
  return testo.split(';').map(s => s.trim()).filter(s => s.split('\n').some(r => r.trim() !== '' && !r.trim().startsWith('--')))
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante')
  const client = new pg.Client({ connectionString: url,ssl: opzioniTls(url),connectionTimeoutMillis: 15_000 })
  await client.connect()
  try {
    await client.query('begin read only')
    for (const sql of spezzaSql(readFileSync(process.argv[2],'utf8'))) {
      const { rows } = await client.query(sql)
      console.log(`-- ${sql.split('\n')[0]}`); console.table(rows)
    }
    await client.query('rollback')
  } finally { await client.end() }
}
// Solo da riga di comando: i test importano spezzaSql senza collegarsi al database.
if (/interroga-sql\.ts$/.test(process.argv[1] ?? '')) main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
