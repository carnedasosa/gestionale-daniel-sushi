// Uso: npx tsx --env-file=.env.local scripts/applica-sql.ts percorso.sql [--prova | --conferma]
// Esegue un file SQL sul database di DATABASE_URL (connessione cifrata come l'app), in una sola transazione.
// Senza --prova o --conferma mostra solo il riepilogo ed esce con codice 2, senza collegarsi.
// Niente domande a video: lo lanciano anche agenti senza tastiera. La logica e i suoi test sono in scripts/applica-sql/.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { opzioniTls } from '../src/server/tls-db'
import { avvia, ErroreUso, USCITA, USO } from './applica-sql/logica'

const url = process.env.DATABASE_URL
avvia(process.argv.slice(2), {
  url,
  leggiFile: percorso => readFileSync(percorso),
  versioniLocali: () => readdirSync(path.resolve('supabase/migrations')).map(f => /^([0-9]+)_.*\.sql$/.exec(f)?.[1]).filter((v): v is string => !!v),
  async collega() {
    const client = new pg.Client({ connectionString: url, ssl: opzioniTls(url!), connectionTimeoutMillis: 15_000 })
    await client.connect()
    return {
      db: {
        esegui: async sql => { await client.query(sql) },
        query: async <T>(sql: string, parametri: unknown[] = []) => (await client.query(sql, parametri)).rows as T[],
      },
      chiudi: () => client.end(),
    }
  },
  stampa: riga => console.log(riga),
  avvisa: riga => console.error(riga),
}).then(codice => { process.exitCode = codice }).catch(err => {
  console.error(err instanceof Error ? err.message : err)
  if (err instanceof ErroreUso) console.error(`\n${USO}`)
  process.exitCode = USCITA.errore
})
