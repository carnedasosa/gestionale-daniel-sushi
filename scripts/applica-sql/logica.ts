// Logica di scripts/applica-sql.ts, separata dal main per provarla su PGlite (logica.test.ts).
import { createHash } from 'node:crypto'
import path from 'node:path'

/** Il minimo che serve del database: lo implementano `pg.Client` nello script e PGlite nei test. */
export interface Esecutore {
  /** Esegue un testo con una o più istruzioni, senza parametri. */
  esegui(sql: string): Promise<void>
  /** Esegue una sola istruzione con parametri e restituisce le righe. */
  query<T = Record<string, unknown>>(sql: string, parametri?: unknown[]): Promise<T[]>
}

// Tempi dentro la transazione dello script, impostati con «set local» (vedi `applica`).
export const SECONDI_ISTRUZIONE = 120
export const LOCK_TIMEOUT_MS = 5_000

export const USO = `Uso: npx tsx --env-file=.env.local scripts/applica-sql.ts <file.sql> [--prova | --conferma] [--crea-registro] [--secondi-istruzione=N]
  (senza flag)             mostra il riepilogo (database, file, impronta) e non si collega nemmeno
  --prova                  esegue il file in una transazione e fa rollback: dice se l'SQL passa, non lascia nulla
  --conferma               esegue il file in una sola transazione e, se è una migrazione, la registra
  --crea-registro          crea supabase_migrations.schema_migrations se manca (database nuovo)
  --secondi-istruzione=N   tempo massimo di una singola istruzione (predefinito ${SECONDI_ISTRUZIONE} s)`

/** Errore d'uso: argomenti sbagliati, file fuori posto. Il main lo stampa con le istruzioni. */
export class ErroreUso extends Error {}

export interface Argomenti { file: string; conferma: boolean; prova: boolean; creaRegistro: boolean; secondiIstruzione: number }

export function leggiArgomenti(argv: string[]): Argomenti {
  const arg: Argomenti = { file: '', conferma: false, prova: false, creaRegistro: false, secondiIstruzione: SECONDI_ISTRUZIONE }
  for (const a of argv) {
    const secondi = /^--secondi-istruzione=(\d+)$/.exec(a)
    if (a === '--conferma') arg.conferma = true
    else if (a === '--prova') arg.prova = true
    else if (a === '--crea-registro') arg.creaRegistro = true
    else if (secondi && Number(secondi[1]) >= 1 && Number(secondi[1]) <= 3600) arg.secondiIstruzione = Number(secondi[1])
    else if (a.startsWith('--')) throw new ErroreUso(`Opzione non riconosciuta: ${a}`)
    else if (arg.file) throw new ErroreUso('Un solo file SQL per volta')
    else arg.file = a
  }
  if (!arg.file) throw new ErroreUso('Manca il file SQL')
  if (arg.conferma && arg.prova) throw new ErroreUso('--prova e --conferma insieme non hanno senso: scegline uno')
  return arg
}

export interface Connessione { host: string; porta: string; database: string; utente: string }

/** Le parti dell'indirizzo che si possono mostrare: mai la password, mai l'URL intero. */
export function descriviConnessione(url: string): Connessione {
  let u: URL
  try { u = new URL(url) } catch { throw new Error('DATABASE_URL non è un indirizzo valido') }
  return { host: u.hostname, porta: u.port || '5432', database: decodeURIComponent(u.pathname.replace(/^\//, '')) || '(predefinito)', utente: decodeURIComponent(u.username) || '(nessuno)' }
}

/** Stesso schema della CLI di Supabase (`MIGRATE_FILE_PATTERN`): `<cifre>_<nome>.sql`. */
const NOME_MIGRAZIONE = /^([0-9]+)_(.*)\.sql$/

export interface Migrazione { versione: string; nome: string }
export interface FileSql { percorso: string; byte: number; sha256: string; testo: string; migrazione: Migrazione | null }

/**
 * Un file è una migrazione se sta in `supabase/migrations/` della radice del progetto e si chiama
 * `<versione>_<nome>.sql`. Lì dentro un nome diverso è un errore: la CLI di Supabase e i test lo salterebbero.
 */
export function descriviFile(percorso: string, contenuto: Buffer, radice: string = process.cwd()): FileSql {
  const assoluto = path.resolve(radice, percorso)
  const inMigrazioni = path.relative(path.resolve(radice, 'supabase/migrations'), path.dirname(assoluto)) === ''
  const nome = NOME_MIGRAZIONE.exec(path.basename(assoluto))
  if (inMigrazioni && !nome) throw new ErroreUso(`${path.basename(assoluto)} sta in supabase/migrations ma non si chiama <versione>_<nome>.sql`)
  return {
    percorso: assoluto, byte: contenuto.length, sha256: createHash('sha256').update(contenuto).digest('hex'), testo: contenuto.toString('utf8'),
    migrazione: inMigrazioni && nome ? { versione: nome[1], nome: nome[2] } : null,
  }
}

export type Modo = 'riepilogo' | 'prova' | 'applica'

export function riepilogo(conn: Connessione, file: FileSql, modo: Modo): string {
  const tipo = file.migrazione
    ? `migrazione ${file.migrazione.versione} «${file.migrazione.nome}» (si registra in supabase_migrations.schema_migrations)`
    : 'file SQL qualsiasi (non è in supabase/migrations: non si registra)'
  const cosa = { riepilogo: 'NESSUNA: solo riepilogo', prova: 'PROVA: transazione con rollback, non resta nulla', applica: 'ESECUZIONE VERA: una transazione, poi commit' }[modo]
  return [
    `Database  host ${conn.host}, porta ${conn.porta}, database ${conn.database}, utente ${conn.utente}`,
    `File      ${file.percorso}`,
    `          ${file.byte} byte, SHA-256 ${file.sha256}`,
    `Tipo      ${tipo}`,
    `Azione    ${cosa}`,
  ].join('\n')
}

const DOLLARI = /\$([A-Za-z_][A-Za-z_0-9]*)?\$/y
const CONTROLLO_TRANSAZIONE = /^(begin|start\s+transaction|commit|end|rollback|abort|savepoint|release|prepare\s+transaction)\b/i

/**
 * Le istruzioni del file che aprono o chiudono una transazione (`begin;`, `commit;`, …). Lo script le rifiuta:
 * un `commit` nel file chiuderebbe la transazione dello script, e una «prova» scriverebbe davvero.
 * Salta commenti, stringhe e corpi tra dollari (`$$ … $$`), dove `begin` ed `end;` sono PL/pgSQL.
 * Non capisce i corpi SQL `begin atomic … end`: per le funzioni usare `$$`.
 */
export function istruzioniDiTransazione(sql: string): string[] {
  const trovate: string[] = []
  let corrente = '', i = 0
  const chiudi = () => { const s = corrente.trim().replace(/\s+/g, ' '); if (CONTROLLO_TRANSAZIONE.test(s)) trovate.push(s.slice(0, 60)); corrente = '' }
  while (i < sql.length) {
    DOLLARI.lastIndex = i
    const dollari = sql[i] === '$' ? DOLLARI.exec(sql) : null
    if (sql.startsWith('--', i)) { const fine = sql.indexOf('\n', i); i = fine === -1 ? sql.length : fine }
    else if (sql.startsWith('/*', i)) {
      let livello = 1; i += 2
      while (i < sql.length && livello > 0) {
        if (sql.startsWith('/*', i)) { livello++; i += 2 } else if (sql.startsWith('*/', i)) { livello--; i += 2 } else i++
      }
      corrente += ' '
    } else if (dollari) { const fine = sql.indexOf(dollari[0], i + dollari[0].length); i = fine === -1 ? sql.length : fine + dollari[0].length; corrente += ' $corpo$ ' }
    else if (sql[i] === "'" || sql[i] === '"') {
      const apice = sql[i]; i++
      while (i < sql.length) { if (sql[i] !== apice) i++; else if (sql[i + 1] === apice) i += 2; else break }
      i++; corrente += ' «testo» '
    } else if (sql[i] === ';') { chiudi(); i++ }
    else { corrente += sql[i]; i++ }
  }
  chiudi()
  return trovate
}

// Struttura presa dal sorgente della CLI di Supabase (apps/cli/src/command-internal/migration-history.ts,
// ramo develop letto il 10/11/2026): `version text primary key`, più `statements text[]` e `name text`
// aggiunte con «add column if not exists». Il progetto reale ha anche colonne della piattaforma
// (created_by, idempotency_key, rollback), tutte facoltative: lo script non le tocca.
const CREA_REGISTRO = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
  alter table supabase_migrations.schema_migrations add column if not exists statements text[];
  alter table supabase_migrations.schema_migrations add column if not exists name text;
`

async function colonneRegistro(db: Esecutore): Promise<Set<string>> {
  const righe = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'`)
  return new Set(righe.map(r => r.column_name))
}

const idTransazione = async (db: Esecutore) => String((await db.query<{ id: unknown }>('select txid_current() as id'))[0].id)

export interface Opzioni { modo: 'prova' | 'applica'; creaRegistro?: boolean; secondiIstruzione?: number; versioniLocali?: string[] }
export interface Esito { modo: 'prova' | 'applica'; registrata: Migrazione | null; avvisi: string[] }

/**
 * Esegue il file in UNA transazione: o passa tutto (file e riga nel registro) o non resta nulla.
 * In «prova» la transazione finisce sempre con rollback.
 *
 * Migrazioni: la riga in `supabase_migrations.schema_migrations` si scrive nella stessa transazione, e una
 * versione già registrata è rifiutata prima di eseguire il file. Se il registro non esiste lo script si ferma:
 * sul database reale esiste, quindi la sua assenza vuol dire «database sbagliato». Su un database nuovo
 * (ripristino da zero) si passa `creaRegistro`, che lo crea come farebbe la CLI di Supabase.
 * `statements` riceve il file intero come unico elemento: lo script non spezza l'SQL, ma così il registro
 * conserva che cosa è stato applicato.
 *
 * Tempi: il ruolo `postgres` del database reale ha statement_timeout 15 s e lock_timeout 5 s, giusti per
 * l'app ma non per una migrazione che crea un indice o riscrive una tabella. Con «set local» (vale solo in
 * questa transazione, l'unico modo che il pooler in transaction mode rispetta) lo script alza il tempo di
 * una singola istruzione a `secondiIstruzione` e fissa lock_timeout a 5 s, senza dipendere dal ruolo.
 * Il lock resta corto apposta: una migrazione in coda per un lock esclusivo blocca dietro di sé tutte le
 * richieste dell'app su quella tabella. Meglio fallire subito e riprovare che fermare il servizio.
 */
export async function applica(db: Esecutore, file: Pick<FileSql, 'testo' | 'migrazione'>, opzioni: Opzioni): Promise<Esito> {
  const vietate = istruzioniDiTransazione(file.testo)
  if (vietate.length > 0)
    throw new Error(`Il file gestisce da solo la transazione («${vietate[0]}»): toglila, la transazione la apre lo script`)
  const { migrazione } = file
  const avvisi: string[] = []
  await db.esegui('begin')
  try {
    await db.esegui(`set local statement_timeout = ${(opzioni.secondiIstruzione ?? SECONDI_ISTRUZIONE) * 1000}; set local lock_timeout = ${LOCK_TIMEOUT_MS}`)
    let colonne = new Set<string>()
    if (migrazione) {
      colonne = await colonneRegistro(db)
      if (!colonne.has('version')) {
        if (!opzioni.creaRegistro)
          throw new Error('Manca supabase_migrations.schema_migrations: sul database reale esiste, controlla DATABASE_URL. Su un database nuovo aggiungi --crea-registro')
        await db.esegui(CREA_REGISTRO)
        colonne = await colonneRegistro(db)
      }
      const registrate = new Set((await db.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).map(r => r.version))
      if (registrate.has(migrazione.versione)) throw new Error(`La migrazione ${migrazione.versione} è già registrata: non si riapplica`)
      const saltate = (opzioni.versioniLocali ?? []).filter(v => v < migrazione.versione && !registrate.has(v))
      if (saltate.length > 0) avvisi.push(`Migrazioni precedenti non registrate su questo database: ${saltate.join(', ')}`)
    }
    const prima = await idTransazione(db)
    await db.esegui(file.testo)
    if (await idTransazione(db) !== prima)
      throw new Error('Il file ha chiuso la transazione dello script: una parte può essere già stata scritta, controlla il database a mano')
    if (migrazione) {
      const campi = ['version', ...(colonne.has('name') ? ['name'] : []), ...(colonne.has('statements') ? ['statements'] : [])]
      const valori = { version: migrazione.versione, name: migrazione.nome, statements: [file.testo] }
      await db.query(
        `insert into supabase_migrations.schema_migrations (${campi.join(', ')}) values (${campi.map((_, n) => `$${n + 1}`).join(', ')})`,
        campi.map(c => valori[c as keyof typeof valori]))
    }
    await db.esegui(opzioni.modo === 'prova' ? 'rollback' : 'commit')
  } catch (err) {
    await db.esegui('rollback').catch(() => {})
    throw err
  }
  return { modo: opzioni.modo, registrata: opzioni.modo === 'applica' ? migrazione : null, avvisi }
}

/** Ciò che il main fornisce e i test sostituiscono: ambiente, disco, connessione, terminale. */
export interface Dipendenze {
  url: string | undefined
  radice?: string
  leggiFile(percorso: string): Buffer
  versioniLocali(): string[]
  collega(): Promise<{ db: Esecutore; chiudi(): Promise<void> }>
  stampa(riga: string): void
  avvisa(riga: string): void
}

export const USCITA = { fatto: 0, errore: 1, nonConfermato: 2 } as const

/**
 * Tutto il percorso dello script, dal comando al codice d'uscita. Il riepilogo si stampa sempre per primo;
 * senza --prova o --conferma finisce lì, senza aprire la connessione.
 */
export async function avvia(argv: string[], dip: Dipendenze): Promise<number> {
  const arg = leggiArgomenti(argv)
  if (!dip.url) throw new Error('DATABASE_URL mancante')
  const file = descriviFile(arg.file, dip.leggiFile(arg.file), dip.radice)
  const modo: Modo = arg.prova ? 'prova' : arg.conferma ? 'applica' : 'riepilogo'
  dip.stampa(riepilogo(descriviConnessione(dip.url), file, modo))
  if (modo === 'riepilogo') {
    dip.avvisa('\nNulla eseguito. Controlla host e file qui sopra, poi rilancia con --prova (transazione con rollback) o con --conferma (esecuzione vera).')
    return USCITA.nonConfermato
  }
  const { db, chiudi } = await dip.collega()
  try {
    const esito = await applica(db, file, { modo, creaRegistro: arg.creaRegistro, secondiIstruzione: arg.secondiIstruzione, versioniLocali: dip.versioniLocali() })
    for (const avviso of esito.avvisi) dip.avvisa(`Attenzione: ${avviso}`)
    if (esito.modo === 'prova') dip.stampa('\nProva riuscita: l’SQL passa. Rollback fatto, sul database non è rimasto nulla.')
    else if (esito.registrata) dip.stampa(`\nEseguito e confermato (commit). Migrazione ${esito.registrata.versione} registrata in supabase_migrations.schema_migrations.`)
    else dip.stampa('\nEseguito e confermato (commit). Nessuna riga nel registro delle migrazioni: non è un file di supabase/migrations.')
  } finally { await chiudi() }
  return USCITA.fatto
}
