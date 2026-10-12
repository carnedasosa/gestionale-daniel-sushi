// Uso: npm run ruolo -- daniel@esempio.it admin
// L'utente va prima creato in Supabase → Authentication → Users → Add user.
import pg from 'pg'
import { assegnaRuoloPerEmail } from '../src/auth/ruoli-repo'
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
import { opzioniTls } from '../src/server/tls-db'

// Niente top-level await: senza "type": "module" tsx esegue lo script come CommonJS.
async function main(): Promise<number> {
  const [email, ruolo] = process.argv.slice(2)
  if (!email || (ruolo !== 'admin' && ruolo !== 'staff')) {
    console.error('Uso: npm run ruolo -- <email> <admin|staff>')
    return 1
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL mancante in .env.local')
    return 1
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ...OPZIONI_POOL, max: 1, ssl: opzioniTls(process.env.DATABASE_URL) })
  pool.on('error', err => console.error('Connessione al database persa:', err.message))
  try {
    const db = adattaPool(() => pool)
    const ok = await assegnaRuoloPerEmail(db, email, ruolo)
    console.log(ok ? `Ruolo ${ruolo} assegnato a ${email}` : `Nessun utente con email ${email}`)
    return ok ? 0 : 1
  } finally {
    await pool.end()
  }
}

main().then((codice) => process.exit(codice))
