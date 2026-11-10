import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { creaDbDiTest } from '../../tests/db/pglite'
import { applica, avvia, descriviConnessione, descriviFile, ErroreUso, istruzioniDiTransazione, leggiArgomenti, LOCK_TIMEOUT_MS, SECONDI_ISTRUZIONE, USCITA, type Dipendenze, type Esecutore } from './logica'

const RADICE = path.resolve('/progetto-finto')
const URL_DB = 'postgresql://postgres.abcdefghijklmnop:parola-segretissima@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
const MIGRAZIONE = 'supabase/migrations/20991231120000_tabella_di_prova.sql'
const SQL_BUONO = `create table tabella_di_prova (id int primary key, nota text);\ninsert into tabella_di_prova values (1, 'uno; due'), (2, 'tre');`
// Come fa la CLI di Supabase su un progetto vero (vedi CREA_REGISTRO in logica.ts).
const REGISTRO = `create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);`

let pg: PGlite, db: Esecutore
beforeEach(async () => {
  pg = (await creaDbDiTest()).pg
  db = { esegui: async sql => { await pg.exec(sql) }, query: async <T>(sql: string, parametri: unknown[] = []) => (await pg.query<T>(sql, parametri as never[])).rows }
})
afterEach(async () => { await pg.close() })

const esiste = async (tabella: string) => (await pg.query<{ c: string | null }>('select to_regclass($1)::text as c', [tabella])).rows[0].c !== null
const registrate = async () => (await pg.query<{ version: string; name: string | null; statements: string[] | null }>('select version, name, statements from supabase_migrations.schema_migrations order by version')).rows
const file = (percorso: string, testo: string) => descriviFile(percorso, Buffer.from(testo), RADICE)

/** Lo script intero con disco, connessione e terminale finti: `collega` consegna il PGlite del test. */
function ambiente(file: Record<string, string>, extra: Partial<Dipendenze> = {}) {
  const righe: string[] = []
  const collega = vi.fn(async () => ({ db, chiudi: async () => {} }))
  const dip: Dipendenze = {
    url: URL_DB, radice: RADICE, collega, versioniLocali: () => [],
    leggiFile: p => { if (!(p in file)) throw new Error(`ENOENT: ${p}`); return Buffer.from(file[p]) },
    stampa: r => righe.push(r), avvisa: r => righe.push(r), ...extra,
  }
  return { dip, collega, uscita: () => righe.join('\n') }
}

describe('senza conferma', () => {
  it('mostra il riepilogo, non si collega ed esce con un codice diverso da zero', async () => {
    await pg.exec(REGISTRO)
    const { dip, collega, uscita } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    expect(await avvia([MIGRAZIONE], dip)).toBe(USCITA.nonConfermato)
    expect(USCITA.nonConfermato).not.toBe(0)
    expect(collega).not.toHaveBeenCalled()
    expect(await esiste('tabella_di_prova')).toBe(false)
    expect(await registrate()).toEqual([])
    const testo = uscita()
    expect(testo).toContain('host aws-0-eu-central-1.pooler.supabase.com, porta 6543, database postgres, utente postgres.abcdefghijklmnop')
    expect(testo).toContain(path.join(RADICE, MIGRAZIONE))
    expect(testo).toContain(`${Buffer.byteLength(SQL_BUONO)} byte, SHA-256 ${file(MIGRAZIONE, SQL_BUONO).sha256}`)
    expect(testo).toContain('migrazione 20991231120000 «tabella_di_prova»')
    expect(testo).toContain('--conferma')
    expect(testo).not.toContain('parola-segretissima')
    expect(testo).not.toContain('postgresql://')
  })

  it('rifiuta argomenti sbagliati prima di ogni altra cosa', async () => {
    const { dip, collega } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    await expect(avvia([], dip)).rejects.toThrow(ErroreUso)
    await expect(avvia([MIGRAZIONE, '--conferma', '--prova'], dip)).rejects.toThrow(/scegline uno/)
    await expect(avvia([MIGRAZIONE, '--confermo'], dip)).rejects.toThrow(/non riconosciuta/)
    await expect(avvia([MIGRAZIONE, '--conferma'], { ...dip, url: undefined })).rejects.toThrow('DATABASE_URL mancante')
    await expect(avvia(['non-esiste.sql', '--conferma'], dip)).rejects.toThrow(/ENOENT/)
    expect(collega).not.toHaveBeenCalled()
  })
})

describe('--prova', () => {
  it('dice che l\'SQL passa e non lascia tracce, nemmeno nel registro', async () => {
    await pg.exec(REGISTRO)
    const { dip, uscita } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    expect(await avvia([MIGRAZIONE, '--prova'], dip)).toBe(USCITA.fatto)
    expect(uscita()).toContain('Prova riuscita')
    expect(await esiste('tabella_di_prova')).toBe(false)
    expect(await registrate()).toEqual([])
    // La transazione è chiusa: un'altra prova riparte da capo e dà lo stesso esito.
    expect(await avvia([MIGRAZIONE, '--prova'], dip)).toBe(USCITA.fatto)
  })

  it('riporta l\'errore dell\'SQL che non passa', async () => {
    await pg.exec(REGISTRO)
    const { dip } = ambiente({ [MIGRAZIONE]: 'create table tabella_di_prova (id int); alter table non_esiste add column x int;' })
    await expect(avvia([MIGRAZIONE, '--prova'], dip)).rejects.toThrow(/non_esiste/)
    expect(await esiste('tabella_di_prova')).toBe(false)
  })

  it('non crea il registro anche con --crea-registro', async () => {
    const { dip } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    expect(await avvia([MIGRAZIONE, '--prova', '--crea-registro'], dip)).toBe(USCITA.fatto)
    expect(await esiste('supabase_migrations.schema_migrations')).toBe(false)
  })
})

describe('--conferma', () => {
  it('esegue la migrazione e la registra con versione, nome e testo', async () => {
    await pg.exec(REGISTRO)
    const { dip, uscita } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    expect(await avvia([MIGRAZIONE, '--conferma'], dip)).toBe(USCITA.fatto)
    expect((await pg.query('select * from tabella_di_prova order by id')).rows).toEqual([{ id: 1, nota: 'uno; due' }, { id: 2, nota: 'tre' }])
    expect(await registrate()).toEqual([{ version: '20991231120000', name: 'tabella_di_prova', statements: [SQL_BUONO] }])
    expect(uscita()).toContain('Migrazione 20991231120000 registrata')
  })

  it('rifiuta di riapplicare una versione già registrata, senza eseguire il file', async () => {
    await pg.exec(REGISTRO)
    const { dip } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    await avvia([MIGRAZIONE, '--conferma'], dip)
    // Stessa versione con un SQL che passerebbe: deve fermarsi sul registro, non sull'errore di Postgres.
    const altro = ambiente({ [MIGRAZIONE]: 'create table seconda_volta (id int);' })
    await expect(avvia([MIGRAZIONE, '--conferma'], altro.dip)).rejects.toThrow('La migrazione 20991231120000 è già registrata: non si riapplica')
    await expect(avvia([MIGRAZIONE, '--prova'], altro.dip)).rejects.toThrow(/già registrata/)
    expect(await esiste('seconda_volta')).toBe(false)
    expect(await registrate()).toHaveLength(1)
  })

  it('un file che fallisce a metà non lascia nulla: né tabelle, né righe, né registro', async () => {
    await pg.exec(REGISTRO)
    const { dip } = ambiente({ [MIGRAZIONE]: `${SQL_BUONO}\nalter table impostazioni_casa add column colonna_di_prova int;\nselect 1/0;` })
    await expect(avvia([MIGRAZIONE, '--conferma'], dip)).rejects.toThrow(/division by zero/)
    expect(await esiste('tabella_di_prova')).toBe(false)
    expect((await pg.query(`select 1 from information_schema.columns where column_name = 'colonna_di_prova'`)).rows).toEqual([])
    expect(await registrate()).toEqual([])
    // Nessuna transazione rimasta aperta: la stessa migrazione corretta ora passa.
    expect(await avvia([MIGRAZIONE, '--conferma'], ambiente({ [MIGRAZIONE]: SQL_BUONO }).dip)).toBe(USCITA.fatto)
  })

  it('senza registro si ferma prima di eseguire; con --crea-registro lo crea come la CLI di Supabase', async () => {
    const { dip } = ambiente({ [MIGRAZIONE]: SQL_BUONO })
    await expect(avvia([MIGRAZIONE, '--conferma'], dip)).rejects.toThrow(/Manca supabase_migrations\.schema_migrations.*--crea-registro/)
    expect(await esiste('tabella_di_prova')).toBe(false)
    expect(await avvia([MIGRAZIONE, '--conferma', '--crea-registro'], dip)).toBe(USCITA.fatto)
    expect(await registrate()).toEqual([{ version: '20991231120000', name: 'tabella_di_prova', statements: [SQL_BUONO] }])
  })

  it('un registro con la sola colonna version riceve solo la versione', async () => {
    await pg.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text not null primary key);')
    await applica(db, file(MIGRAZIONE, SQL_BUONO), { modo: 'applica' })
    expect((await pg.query('select * from supabase_migrations.schema_migrations')).rows).toEqual([{ version: '20991231120000' }])
  })

  it('un file fuori da supabase/migrations si esegue senza registro', async () => {
    const { dip, uscita } = ambiente({ 'docs/allergeni/prova.sql': SQL_BUONO, 'altrove/20991231120000_sembra.sql': 'create table sembra (id int);' })
    expect(await avvia(['docs/allergeni/prova.sql', '--conferma'], dip)).toBe(USCITA.fatto)
    expect(await avvia(['altrove/20991231120000_sembra.sql', '--conferma'], dip)).toBe(USCITA.fatto)
    expect(await esiste('tabella_di_prova')).toBe(true)
    expect(await esiste('sembra')).toBe(true)
    expect(await esiste('supabase_migrations.schema_migrations')).toBe(false)
    expect(uscita()).toContain('Nessuna riga nel registro')
  })

  it('avvisa se migrazioni locali precedenti non risultano registrate', async () => {
    await pg.exec(`${REGISTRO} insert into supabase_migrations.schema_migrations (version) values ('20990101000000');`)
    const { dip, uscita } = ambiente({ [MIGRAZIONE]: SQL_BUONO }, { versioniLocali: () => ['20990101000000', '20990202000000', '20991231120000', '21000101000000'] })
    expect(await avvia([MIGRAZIONE, '--conferma'], dip)).toBe(USCITA.fatto)
    expect(uscita()).toContain('Migrazioni precedenti non registrate su questo database: 20990202000000')
    expect(uscita()).not.toContain('21000101000000')
  })
})

describe('transazione e tempi', () => {
  it('alza il tempo di istruzione e fissa quello dei lock solo dentro la transazione', async () => {
    const sql = `create table tempi as select current_setting('statement_timeout') as istruzione, current_setting('lock_timeout') as lock;`
    await applica(db, file('tempi.sql', sql), { modo: 'applica' })
    expect((await pg.query('select * from tempi')).rows).toEqual([{ istruzione: `${SECONDI_ISTRUZIONE / 60}min`, lock: `${LOCK_TIMEOUT_MS / 1000}s` }])
    expect((await pg.query(`select current_setting('statement_timeout') as istruzione, current_setting('lock_timeout') as lock`)).rows).toEqual([{ istruzione: '0', lock: '0' }])
    await pg.exec('drop table tempi')
    await applica(db, file('tempi.sql', sql), { modo: 'applica', secondiIstruzione: 900 })
    expect((await pg.query('select istruzione from tempi')).rows).toEqual([{ istruzione: '15min' }])
  })

  it('rifiuta un file che apre o chiude la transazione da solo, anche in prova', async () => {
    for (const sql of ['begin;\ncreate table furba (id int);\ncommit;', 'create table furba (id int); COMMIT ;', 'create table furba (id int);\nrollback']) {
      await expect(applica(db, file('furba.sql', sql), { modo: 'prova' })).rejects.toThrow(/gestisce da solo la transazione/)
      expect(await esiste('furba')).toBe(false)
    }
  })
})

describe('istruzioniDiTransazione', () => {
  it('non scambia per transazioni i begin/end di PL/pgSQL, le stringhe e i commenti', () => {
    expect(istruzioniDiTransazione(`
      -- commit; in un commento
      /* begin; /* annidato */ rollback; */
      create function f() returns void language plpgsql as $$ begin perform 1; end; $$;
      do $corpo$ begin null; commit; end $corpo$;
      insert into t values ('commit; begin;'), ('l''apostrofo; rollback;');
      comment on column t."end; col" is 'fine';
      update t set beginning = 1 where ending = 2;
    `)).toEqual([])
  })

  it('trova begin, commit, rollback, savepoint e simili', () => {
    expect(istruzioniDiTransazione('BEGIN;\nselect 1;\n  Commit ;')).toEqual(['BEGIN', 'Commit'])
    expect(istruzioniDiTransazione('start   transaction isolation level serializable; select 1; end')).toEqual(['start transaction isolation level serializable', 'end'])
    expect(istruzioniDiTransazione('savepoint a; rollback to a; abort;')).toHaveLength(3)
  })

  it('lascia passare tutte le migrazioni reali; il seed, che ha la sua transazione, no', () => {
    const cartella = path.resolve('supabase/migrations')
    const file = readdirSync(cartella).filter(f => f.endsWith('.sql'))
    expect(file.length).toBeGreaterThan(10)
    for (const f of file) expect(istruzioniDiTransazione(readFileSync(path.join(cartella, f), 'utf8')), f).toEqual([])
    expect(istruzioniDiTransazione(readFileSync('supabase/seed.sql', 'utf8'))).toEqual(['begin', 'commit'])
  })
})

describe('argomenti, connessione e file', () => {
  it('legge i flag', () => {
    expect(leggiArgomenti(['a.sql'])).toEqual({ file: 'a.sql', conferma: false, prova: false, creaRegistro: false, secondiIstruzione: SECONDI_ISTRUZIONE })
    expect(leggiArgomenti(['--conferma', 'a.sql', '--crea-registro', '--secondi-istruzione=600'])).toEqual({ file: 'a.sql', conferma: true, prova: false, creaRegistro: true, secondiIstruzione: 600 })
    expect(() => leggiArgomenti(['a.sql', 'b.sql'])).toThrow(/Un solo file/)
    expect(() => leggiArgomenti(['a.sql', '--secondi-istruzione=0'])).toThrow(ErroreUso)
    expect(() => leggiArgomenti(['a.sql', '--secondi-istruzione=tanti'])).toThrow(ErroreUso)
  })

  it('della connessione mostra host, porta, database e utente, mai la password', () => {
    expect(descriviConnessione(URL_DB)).toEqual({ host: 'aws-0-eu-central-1.pooler.supabase.com', porta: '6543', database: 'postgres', utente: 'postgres.abcdefghijklmnop' })
    expect(descriviConnessione('postgres://utente:p%40ss@localhost/prova')).toEqual({ host: 'localhost', porta: '5432', database: 'prova', utente: 'utente' })
    expect(() => descriviConnessione('non un indirizzo')).toThrow('DATABASE_URL non è un indirizzo valido')
  })

  it('riconosce le migrazioni dalla cartella e dal nome', () => {
    expect(file(MIGRAZIONE, 'select 1').migrazione).toEqual({ versione: '20991231120000', nome: 'tabella_di_prova' })
    expect(file(path.join(RADICE, MIGRAZIONE), 'select 1').migrazione).toEqual({ versione: '20991231120000', nome: 'tabella_di_prova' })
    expect(file('scripts/sql/20991231120000_altro.sql', 'select 1').migrazione).toBeNull()
    expect(file('supabase/migrations/vecchie/20991231120000_altro.sql', 'select 1').migrazione).toBeNull()
    expect(() => file('supabase/migrations/correzione.sql', 'select 1')).toThrow(/non si chiama <versione>_<nome>\.sql/)
    expect(file('a.sql', 'select 1')).toMatchObject({ byte: 8, sha256: '822ae07d4783158bc1912bb623e5107cc9002d519e1143a9c200ed6ee18b6d0f' })
  })
})
