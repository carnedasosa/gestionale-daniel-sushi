// Uso: npm run ruolo -- daniel@esempio.it admin
// L'utente va prima creato in Supabase → Authentication → Users → Add user.
import postgres from 'postgres'
import { assegnaRuoloPerEmail } from '../src/auth/ruoli-repo'

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
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 })
  try {
    const db = { query: async <T,>(t: string, p: unknown[] = []) => (await sql.unsafe(t, p as never[])) as unknown as T[] }
    const ok = await assegnaRuoloPerEmail(db, email, ruolo)
    console.log(ok ? `Ruolo ${ruolo} assegnato a ${email}` : `Nessun utente con email ${email}`)
    return ok ? 0 : 1
  } finally {
    await sql.end()
  }
}

main().then((codice) => process.exit(codice))
