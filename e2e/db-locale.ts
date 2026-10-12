// Database finto per le prove end-to-end: PGlite in memoria con migrazioni, seed e dati di prova,
// esposto su 127.0.0.1. Non tocca mai il database reale. Avvio: npm run e2e (lo lancia Playwright).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { createClient } from '@supabase/supabase-js'
import { STUB_SUPABASE } from '../tests/db/pglite'
import { PORTA_DB, TAVOLO_E2E } from './dati'
import { avviaServerPglite } from './server-pglite'

// L'utente di prova esiste su Supabase Auth (login vero); il ruolo admin lo ha solo qui.
async function idUtenteDiProva(): Promise<{ id: string; email: string }> {
  const { SUPABASE_URL: url,SUPABASE_PUBLISHABLE_KEY: chiave,E2E_EMAIL: email,E2E_PASSWORD: password } = process.env
  if (!url || !chiave || !email || !password) throw new Error('Servono SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, E2E_EMAIL ed E2E_PASSWORD in .env.local')
  const supabase = createClient(url,chiave,{ auth: { persistSession: false,autoRefreshToken: false } })
  const { data,error } = await supabase.auth.signInWithPassword({ email,password })
  if (error || !data.user) throw new Error(`Login dell'utente di prova non riuscito: ${error?.message ?? 'nessun utente'}`)
  await supabase.auth.signOut({ scope: 'local' })
  return { id: data.user.id,email }
}

async function avvia() {
  const utente = await idUtenteDiProva()
  const db = new PGlite()
  await db.exec(STUB_SUPABASE)
  const cartella = path.resolve('supabase/migrations')
  for (const file of readdirSync(cartella).filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(path.join(cartella,file),'utf8'))
  await db.exec(readFileSync('supabase/seed.sql','utf8'))
  await db.query('insert into auth.users (id,email) values ($1,$2)',[utente.id,utente.email])
  await db.query(`insert into profili (user_id,ruolo) values ($1,'admin')`,[utente.id])
  await db.query('insert into tavoli (nome,slug,chiave) values ($1,$2,$3)',[TAVOLO_E2E.nome,TAVOLO_E2E.slug,TAVOLO_E2E.chiave])
  // Menù ordinabile anche da casa: allergeni confermati e poke con prezzi e allergeni.
  await db.exec(`
    update piatti set allergeni_confermati = true;
    update poke_config set prezzo_base_cent = 900, prezzo_extra_cent = 100, allergeni_confermati = true;
    update impostazioni_casa set capacita_fascia = 4, capacita_consegne = 2, anticipo_minuti = 0, telefono = '0801234567';
    insert into zone_consegna (nome,costo_cent,minimo_cent) values ('Centro',200,1500);
    insert into orari_casa (servizio,giorno,dalle,alle)
      select s,g,'00:00','23:59' from unnest(array['asporto','domicilio']) s, generate_series(1,7) g;
  `)
  const server = await avviaServerPglite(db,PORTA_DB)
  console.log(`Database di prova pronto su 127.0.0.1:${PORTA_DB}`)
  const chiudi = () => { server.close(); void db.close().finally(() => process.exit(0)) }
  process.on('SIGINT',chiudi); process.on('SIGTERM',chiudi)
}

avvia().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
