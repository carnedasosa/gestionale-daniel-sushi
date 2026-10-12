# Correzioni della PR #3 — Implementation Plan

> **Per chi esegue (Codex o altro agente):** esegui questo piano task per task, **nell'ordine**, spuntando le checkbox `- [ ]`. Il codice in questo piano **è già stato scritto e verificato** sull'HEAD `51d2749` (suite completa 191 test verde, `tsc`, `eslint`, `next build`, prova di sola lettura sul Supabase reale; la gestione del ruolo con DB giù nel Task 2 è stata aggiunta dopo e verificata sui test dell’area staff, `tsc` ed `eslint`). Il tuo compito è **riportarlo fedelmente**, eseguire i test e fare i commit. Leggi prima la sezione «Regole di esecuzione»: valgono più di qualunque tua preferenza.

**Goal:** Chiudere i punti N1–N4 della revisione della PR #3 (`.superpowers/review-correzioni-tappa-2.md`) e sei rifiniture minori, così la PR #3 si può unire a `main`.

**Architecture:** Si sostituisce il driver `postgres` (postgres.js) con `pg` (node-postgres) dietro la stessa interfaccia `Db`; il resto sono modifiche puntuali a componenti, funzioni di dominio e repository esistenti. Nessuna migrazione nuova, nessuna modifica allo schema.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, `pg` 8.23.0, Vitest 5 con PGlite, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`. **Revisione da chiudere:** `.superpowers/review-correzioni-tappa-2.md` (sezioni N1–N4 e Minor). **Piano precedente:** `docs/superpowers/plans/2026-10-12-correzioni-tappa-2.md`.

---

## Regole di esecuzione (non negoziabili)

1. **Fai solo quello che c'è scritto.** Niente refactoring, rinomini, riformattazioni, aggiornamenti di dipendenze, cambi di stile o «migliorie» non richieste. Se un file non è nominato in un task, non lo tocchi.
2. **Il codice va copiato com'è**, compresi commenti, nomi e virgole senza spazio (lo stile del repo è compatto: `a,b` invece di `a, b`; non «sistemarlo»).
3. **Le modifiche sono «sostituisci questo blocco con quest'altro».** Se il blocco «prima» non si trova **identico** nel file, **fermati** e scrivi all'utente quale file e quale blocco non corrispondono. Non adattare a intuito.
4. **Se un test non passa come previsto, fermati** e riporta l'output. Non cambiare il test per farlo passare e non cambiare l'implementazione in modo diverso da quanto scritto. Al massimo un tentativo di correzione di un tuo errore di copia; poi fermati.
5. **Database reale:** nessuna scrittura, migrazione o pulizia sul Supabase reale senza il «sì» esplicito dell'utente in chat. Le sole operazioni consentite senza chiedere sono quelle marcate **(sola lettura)** in questo piano. Non stampare mai il contenuto di `.env.local` né la `DATABASE_URL`.
6. **Non inserire mai password dell'utente.** Per il login nel browser chiedi all'utente di farlo lui.
7. **Non fare merge** della PR #3 e non toccare `main`. Lavori solo sul branch `correzioni-tappa-2`.
8. **Design system:** l'app ora usa «Cupertino» (`src/styles/ds/cupertino.css`, commit `51d2749`). Usa solo classi esistenti (`ds-btn`, `ds-btn--primary|secondary|destructive`, `staff-nota`, `staff-navigazione`, `admin-avviso`, …). Nessun CSS nuovo in questo piano.
9. **Commit piccoli in italiano**, uno per task, con il messaggio indicato. Niente `--no-verify`, niente `git push --force`.
10. Questo è Next.js 16: se devi capire un'API, leggi `node_modules/next/dist/docs/` (vedi `AGENTS.md`), non la memoria.

## Global Constraints

- Branch: `correzioni-tappa-2`, partendo da `51d2749` (o successivo se l'utente ha aggiunto commit: in quel caso `git pull` e fermati se ci sono conflitti).
- Nuove dipendenze ammesse **solo**: `pg@8.23.0` (dependencies, versione esatta) e `@types/pg@8.23.0` (devDependencies, versione esatta). Si rimuove `postgres`. Nessun'altra dipendenza.
- **Non** aggiungere opzioni SSL/TLS al pool: oggi la connessione al pooler non usa TLS (`ssl: false` di default anche in postgres.js); il passaggio a TLS è un tema separato che l'utente deciderà dopo (serve il certificato CA di Supabase).
- Lingua di UI, commenti, test e commit: italiano.
- Prezzi in centesimi interi; nessuna modifica alla logica dei prezzi.
- I limiti dei tentativi diventano: blocco se, negli ultimi 10 minuti e per la sessione aperta, **dispositivo ≥ 5** oppure **rete ≥ 5** oppure **sessione ≥ 30** (quest'ultimo ora vale per tutti, anche dispositivi nuovi). La «rete» è l'IPv4 intero, o il prefisso /64 per IPv6; senza indirizzo si conta solo per dispositivo e sessione.

## Review Focus

1. **Connessione al DB che cade a metà query o a metà transazione** → la query fallisce con un errore, le successive funzionano; nessuna eccezione non gestita, nessuna query appesa. *(Task 1, test d'integrazione con server finto.)*
2. **Un intoppo del DB durante il servizio** → lo schermo cucina resta montato con gli ultimi dati, suono attivo, e l'ordine arrivato durante l'intoppo viene segnalato con badge e suono. *(Task 2.)*
3. **Il cameriere apre il conto, intanto arriva un ordine, poi chiude** → avviso sulla pagina del conto e conferma alla chiusura, anche se sono passati più di 10 secondi. *(Task 4.)*
4. **Qualcuno con il QR prova i codici cambiando indirizzo IPv6** → dopo 30 errori sulla sessione nessun nuovo telefono entra finché lo staff non sblocca. *(Task 5.)*
5. **Navigare `/staff` → conto → `/staff`** → il suono resta attivo e gli ordini arrivati nel frattempo sono segnalati. *(Task 2.)*

## Stato verificato (12/10/2026, sola lettura)

- DB reale: 3 migrazioni registrate in `supabase_migrations.schema_migrations`: `20261011163506 menu_e_ruoli`, `20261012120000 tavoli_e_ordini`, `20261012180000 correzioni_tavolo`. Il file locale della prima si chiama però `20261011120000_menu_e_ruoli.sql` (vedi Task 6). 0 ordini, 0 sessioni aperte, 0 tentativi, 139 piatti, 2 tavoli.
- `pg@8.23.0` provato in sola lettura sul pooler reale con la `DATABASE_URL` attuale: connessione ok, `text[]` → array, `int` → number, `jsonb` → oggetto, `timestamptz` → `Date`, transazione ok.
- Suite su `51d2749`: 39 file, 173 test verdi. Dopo questo piano: 41 file, 192 test.

---

### Task 0: Preparazione

- [x] `git status` deve essere pulito. `git checkout correzioni-tappa-2 && git pull`.
- [x] `git log --oneline -1` deve mostrare `51d2749` o un commit successivo dell'utente. Se successivo, controlla con `git diff 51d2749 --stat` che non tocchi i file di questo piano; se li tocca, **fermati** e chiedi all'utente.
- [x] `npm ci` e poi `npm test` → atteso: **39 file, 173 test passati**. Se no, fermati.

---

### Task 1: N1 — Driver `pg` al posto di postgres.js

**Perché (non tornare indietro):** la revisione ha dimostrato che `reserve()`/`release()` di postgres@3.4.9 rimette in uso una connessione morta. Nella verifica di questo piano è emerso anche che `sql.begin` di postgres@3.4.9 (ultima versione disponibile), se la connessione cade durante una transazione, invia un `rollback` su un socket nullo: eccezione non gestita (`Cannot read properties of null (reading 'write')`) e quella connessione resta inutilizzabile per sempre. Riprodotto con pool da 1 connessione: le tre query successive falliscono ciascuna dopo il `connect_timeout` (`CONNECT_TIMEOUT`, 3 s nel test, 30 s di default). Il difetto c'è anche su `main`. `pg` invece non mette mai due query sulla stessa connessione (niente pipelining, quindi niente «risultati scambiati» col pooler), dopo un errore rifiuta subito le query sulla connessione rotta e `release(errore)` la scarta dal pool.

**File:**
- Modifica: `package.json`, `package-lock.json` (via npm)
- Riscrivi: `src/server/db-adapter.ts`, `src/server/db.ts`, `src/server/db.test.ts`
- Crea: `tests/server/postgres-finto.ts`, `src/server/db.integrazione.test.ts`
- Modifica: `scripts/assegna-ruolo.ts`, `scripts/verifica-poke-postgres.ts`, `docs/verifiche/correzioni-tappa-2/README.md`

**Interfacce prodotte:** `adattaPool(pool: () => pg.Pool): Db`, `OPZIONI_POOL`, `db: Db` (invariato per tutto il resto dell'app). Sparisce `adattaSql`.

- [x] **Step 1: dipendenze**

```bash
npm install --save-exact pg@8.23.0
npm install --save-dev --save-exact @types/pg@8.23.0
npm uninstall postgres
```

Controlla in `package.json`: `"pg": "8.23.0"` in `dependencies`, `"@types/pg": "8.23.0"` in `devDependencies`, nessuna riga `"postgres"`.

- [x] **Step 2: server Postgres finto per i test** — crea `tests/server/postgres-finto.ts` con esattamente:

```ts
import net from 'node:net'

// Server finto che parla il protocollo v3 di Postgres quanto basta a un driver, senza database.
// - una query che contiene «cade» chiude il socket senza rispondere (connessione persa a metà);
// - una query che contiene «lenta» risponde dopo 30 ms;
// - begin/commit/rollback aggiornano lo stato della transazione;
// - ogni altra query restituisce una riga { n: '1' }.
export interface PostgresFinto {
  url: string
  /** connessioni TCP accettate */
  connessioni: () => number
  /** massimo di query in volo sulla stessa connessione (>1 = pipelining) */
  massimoPerConnessione: () => number
  /** massimo di query in volo su tutte le connessioni insieme */
  massimoTotale: () => number
  chiudi: () => Promise<void>
}

const int16 = (n: number) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b }
const int32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b }
const cstr = (s: string) => Buffer.from(s + '\0')
const msg = (tipo: string, corpo: Buffer = Buffer.alloc(0)) => Buffer.concat([Buffer.from(tipo), int32(corpo.length + 4), corpo])
// Una colonna «n» di tipo text (oid 25) e una riga con il valore '1'.
const DESCRIZIONE = msg('T', Buffer.concat([int16(1), cstr('n'), int32(0), int16(0), int32(25), int16(-1), int32(-1), int16(0)]))
const RIGA = msg('D', Buffer.concat([int16(1), int32(1), Buffer.from('1')]))
const attendi = (ms: number) => new Promise(r => setTimeout(r, ms))
interface Messaggio { tipo: string; corpo: Buffer }

export async function avviaPostgresFinto(): Promise<PostgresFinto> {
  let connessioni = 0, totale = 0, massimoTotale = 0, massimoPerConnessione = 0
  const aperti = new Set<net.Socket>()
  const server = net.createServer(s => {
    connessioni++; aperti.add(s); s.on('error', () => {})
    let buffer = Buffer.alloc(0), avviato = false, stato = 'I', inVolo = 0, catena = Promise.resolve()
    // Query del protocollo esteso in corso: da Parse fino a Sync, anche attraverso un Flush.
    let estesa: { testo: string; parametri: number } | null = null, gruppo: Messaggio[] = []
    s.on('close', () => { aperti.delete(s); totale -= inVolo; inVolo = 0 })
    const inizia = () => { inVolo++; totale++; massimoPerConnessione = Math.max(massimoPerConnessione, inVolo); massimoTotale = Math.max(massimoTotale, totale) }
    const rispondi = (testo: string, corpo: () => Buffer, fine: boolean) => {
      catena = catena.then(async () => {
        if (s.destroyed) return
        if (testo.includes('cade')) { s.destroy(); return }
        if (testo.includes('lenta')) await attendi(30)
        if (s.destroyed) return
        if (fine && /^\s*begin/i.test(testo)) stato = 'T'
        else if (fine && /^\s*(commit|rollback)/i.test(testo)) stato = 'I'
        const fuori = corpo()
        if (fine) { inVolo--; totale-- }
        s.write(fine ? Buffer.concat([fuori, msg('Z', Buffer.from(stato))]) : fuori)
      })
    }
    const risposte = (messaggi: Messaggio[], parametri: number) => Buffer.concat(messaggi.map(m =>
      m.tipo === 'P' ? msg('1')
      : m.tipo === 'B' ? msg('2')
      // Describe di uno statement ('S') vuole anche la descrizione dei parametri (qui tutti text).
      : m.tipo === 'D' ? (m.corpo[0] === 0x53 ? Buffer.concat([msg('t', Buffer.concat([int16(parametri), ...Array.from({ length: parametri }, () => int32(25))])), DESCRIZIONE]) : DESCRIZIONE)
      : m.tipo === 'E' ? Buffer.concat([RIGA, msg('C', cstr('SELECT 1'))])
      : Buffer.alloc(0)))
    s.on('data', dati => {
      buffer = Buffer.concat([buffer, dati])
      if (!avviato) {
        if (buffer.length < 4 || buffer.length < buffer.readInt32BE(0)) return
        buffer = buffer.subarray(buffer.readInt32BE(0)); avviato = true
        s.write(Buffer.concat([msg('R', int32(0)), msg('K', Buffer.concat([int32(1), int32(1)])), msg('Z', Buffer.from('I'))]))
      }
      while (buffer.length >= 5 && buffer.length >= 1 + buffer.readInt32BE(1)) {
        const tipo = String.fromCharCode(buffer[0]), fine = 1 + buffer.readInt32BE(1)
        const corpo = buffer.subarray(5, fine); buffer = buffer.subarray(fine)
        if (tipo === 'X') { s.end(); return }
        if (tipo === 'Q') {
          const testo = corpo.toString('utf8', 0, corpo.indexOf(0))
          const comando = /^\s*(\w+)/.exec(testo)?.[1]?.toUpperCase() ?? 'SELECT'
          inizia()
          rispondi(testo, () => comando === 'SELECT' ? Buffer.concat([DESCRIZIONE, RIGA, msg('C', cstr('SELECT 1'))]) : msg('C', cstr(comando)), true)
        } else if (tipo === 'H' || tipo === 'S') {
          const q = estesa ?? { testo: '', parametri: 0 }, messaggi = gruppo
          gruppo = []
          if (tipo === 'S') estesa = null
          rispondi(q.testo, () => risposte(messaggi, q.parametri), tipo === 'S')
        } else {
          if (!estesa) { estesa = { testo: '', parametri: 0 }; inizia() }
          if (tipo === 'P') {
            const fineNome = corpo.indexOf(0), fineTesto = corpo.indexOf(0, fineNome + 1)
            estesa.testo = corpo.toString('utf8', fineNome + 1, fineTesto)
            estesa.parametri = corpo.readInt16BE(fineTesto + 1)
          }
          gruppo.push({ tipo, corpo })
        }
      }
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as net.AddressInfo
  return {
    url: `postgres://prova:prova@127.0.0.1:${port}/prova`,
    connessioni: () => connessioni,
    massimoPerConnessione: () => massimoPerConnessione,
    massimoTotale: () => massimoTotale,
    chiudi: () => new Promise(r => { for (const s of aperti) s.destroy(); server.close(() => r()) }),
  }
}
```

- [x] **Step 3: test d'integrazione (prima del codice)** — crea `src/server/db.integrazione.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import pg from 'pg'
import { avviaPostgresFinto, type PostgresFinto } from '../../tests/server/postgres-finto'
import { adattaPool, OPZIONI_POOL } from './db-adapter'

// Stesso pool della produzione (src/server/db.ts), puntato su un server Postgres finto.
let server: PostgresFinto, pool: pg.Pool
beforeEach(async () => {
  server = await avviaPostgresFinto()
  pool = new pg.Pool({ connectionString: server.url, ...OPZIONI_POOL, connectionTimeoutMillis: 2000 })
  pool.on('error', () => {})
})
afterEach(async () => { await pool.end(); await server.chiudi() })

it('una connessione persa durante una lettura non blocca il pool', async () => {
  const db = adattaPool(() => pool)
  await expect(db.query("select 'cade' as n")).rejects.toThrow()
  await expect(db.query('select 1 as n')).resolves.toEqual([{ n: '1' }])
  await expect(db.query('select $1::int as n', [1])).resolves.toEqual([{ n: '1' }])
  const tutte = await Promise.all(Array.from({ length: 12 }, () => db.query('select 1 as n')))
  expect(tutte).toEqual(Array.from({ length: 12 }, () => [{ n: '1' }]))
}, 5000)

it('una connessione persa dentro una transazione viene scartata e il pool continua', async () => {
  const db = adattaPool(() => pool)
  await expect(db.transazione(tx => tx.query("select 'cade' as n"))).rejects.toThrow()
  // Ogni connessione del pool deve funzionare: ne usiamo più del massimo, in sequenza e in parallelo.
  for (let i = 0; i < OPZIONI_POOL.max + 1; i++) await expect(db.transazione(tx => tx.query('select 1 as n'))).resolves.toEqual([{ n: '1' }])
  await expect(Promise.all(Array.from({ length: 12 }, () => db.transazione(tx => tx.query('select 1 as n'))))).resolves.toHaveLength(12)
  expect(pool.totalCount).toBeLessThanOrEqual(OPZIONI_POOL.max)
}, 5000)

it('un errore SQL nella transazione fa rollback e la connessione torna nel pool', async () => {
  const db = adattaPool(() => pool)
  const prima = server.connessioni()
  await expect(db.transazione(async tx => { await tx.query('select 1 as n'); throw new Error('regola violata') })).rejects.toThrow('regola violata')
  await expect(db.transazione(tx => tx.query('select 1 as n'))).resolves.toEqual([{ n: '1' }])
  expect(server.connessioni() - prima).toBe(1)
}, 5000)

it('non accoda mai due query sulla stessa connessione', async () => {
  const db = adattaPool(() => pool)
  await Promise.all([
    ...Array.from({ length: 10 }, () => db.query("select 'lenta' as n")),
    ...Array.from({ length: 3 }, () => db.transazione(tx => tx.query("select 'lenta' as n"))),
  ])
  expect(server.massimoPerConnessione()).toBe(1)
  expect(server.connessioni()).toBeLessThanOrEqual(OPZIONI_POOL.max)
}, 5000)

it('una connessione inattiva che cade non fa terminare il processo', async () => {
  const errori = vi.fn()
  pool.removeAllListeners('error'); pool.on('error', errori)
  await adattaPool(() => pool).query('select 1 as n')
  await server.chiudi()
  await vi.waitFor(() => expect(errori).toHaveBeenCalled())
}, 5000)
```

- [x] **Step 4:** `npx vitest run src/server/db.integrazione.test.ts` → atteso **FAIL** all'import (`adattaPool`/`OPZIONI_POOL` non esistono ancora).

- [x] **Step 5: adattatore** — sostituisci **tutto** `src/server/db-adapter.ts` con:

```ts
import type pg from 'pg'
import type { Db } from './db-tipi'

// Massimo 5 connessioni verso il transaction pooler di Supabase (porta 6543).
// Chi chiede una connessione oltre il limite aspetta al massimo 10 secondi, poi riceve un errore.
export const OPZIONI_POOL = { max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 } satisfies pg.PoolConfig

function suConnessione(c: pg.PoolClient): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) { return (await c.query(testo, parametri)).rows as T[] },
    async transazione() { throw new Error('Transazioni annidate non supportate') },
  }
}

// pg non accoda mai due query sulla stessa connessione e, dopo un errore di connessione,
// rifiuta subito le query successive su quella connessione invece di bloccarsi.
export function adattaPool(pool: () => pg.Pool): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) {
      // pool.query restituisce la connessione al pool, o la scarta se è caduta.
      return (await pool().query(testo, parametri)).rows as T[]
    },
    async transazione<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const c = await pool().connect()
      let scarta: Error | undefined
      // Mentre la connessione è in uso il pool non ne ascolta gli errori: senza questo ascoltatore
      // una caduta durante la transazione diventerebbe un'eccezione non gestita.
      const caduta = (err: Error) => { scarta = err }
      c.on('error', caduta)
      try {
        await c.query('begin')
        const risultato = await fn(suConnessione(c))
        await c.query('commit')
        return risultato
      } catch (err) {
        // Se il rollback fallisce la connessione non è affidabile: release(errore) la chiude
        // invece di rimetterla nel pool. L'errore da riportare resta quello originale.
        await c.query('rollback').catch((e: unknown) => { scarta = e instanceof Error ? e : new Error('Rollback non riuscito') })
        throw err
      } finally {
        c.off('error', caduta)
        c.release(scarta)
      }
    },
  }
}
```

- [x] **Step 6: client dell'app** — sostituisci **tutto** `src/server/db.ts` con:

```ts
import 'server-only'
import pg from 'pg'
import type { Db } from './db-tipi'
import { adattaPool, OPZIONI_POOL } from './db-adapter'

let pool: pg.Pool | undefined
function client(): pg.Pool {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante: vedi .env.example')
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, ...OPZIONI_POOL })
    // Senza questo ascoltatore, una connessione inattiva che cade farebbe terminare il processo.
    pool.on('error', err => console.error('Connessione al database persa:', err.message))
  }
  return pool
}

export const db: Db = adattaPool(client)
```

- [x] **Step 7: test unitario** — sostituisci **tutto** `src/server/db.test.ts` con:

```ts
import { afterEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ Pool: vi.fn(), query: vi.fn(), on: vi.fn() }))
vi.mock('pg', () => ({ default: { Pool: m.Pool } }))
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.resetAllMocks() })
it('senza DATABASE_URL la query fallisce con un messaggio chiaro', async () => {
  vi.stubEnv('DATABASE_URL', '')
  const { db } = await import('./db')
  await expect(db.query('select 1')).rejects.toThrow('DATABASE_URL mancante')
  expect(m.Pool).not.toHaveBeenCalled()
})
it('crea un solo pool con le opzioni condivise, ne ascolta gli errori e restituisce le righe', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://prova')
  m.Pool.mockImplementation(function () { return { query: m.query, on: m.on } })
  m.query.mockResolvedValueOnce({ rows: [{ a: 1 }] }).mockResolvedValueOnce({ rows: [] })
  const { db } = await import('./db')
  expect(await db.query('select $1 as a', [1])).toEqual([{ a: 1 }])
  expect(await db.query('select 2')).toEqual([])
  expect(m.Pool).toHaveBeenCalledOnce()
  expect(m.Pool).toHaveBeenCalledWith({ connectionString: 'postgres://prova', max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
  expect(m.on).toHaveBeenCalledWith('error', expect.any(Function))
  expect(m.query).toHaveBeenNthCalledWith(1, 'select $1 as a', [1])
  expect(m.query).toHaveBeenNthCalledWith(2, 'select 2', [])
})
```

- [x] **Step 8: script** — in `scripts/assegna-ruolo.ts` sostituisci:

```ts
import postgres from 'postgres'
```
con
```ts
import pg from 'pg'
```
poi
```ts
import { adattaSql } from '../src/server/db-adapter'
```
con
```ts
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
```
poi
```ts
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 })
  try {
    const db = adattaSql(sql)
```
con
```ts
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ...OPZIONI_POOL, max: 1 })
  pool.on('error', err => console.error('Connessione al database persa:', err.message))
  try {
    const db = adattaPool(() => pool)
```
e infine `    await sql.end()` con `    await pool.end()`.

- [x] **Step 9:** in `scripts/verifica-poke-postgres.ts` sostituisci:

```ts
import postgres from 'postgres'
import { adattaSql } from '../src/server/db-adapter'
```
con
```ts
import pg from 'pg'
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
```
poi
```ts
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false })
```
con
```ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL!, ...OPZIONI_POOL, max: 1 })
pool.on('error', err => console.error('Connessione al database persa:', err.message))
```
poi
```ts
  await sql.begin(async tx => {
    await tx.unsafe('create temporary table poke_config (like public.poke_config including all) on commit drop')
    await tx.unsafe('insert into pg_temp.poke_config select * from public.poke_config')
    // Recupera anche una configurazione di prova salvata dal vecchio driver.
    await tx.unsafe("update pg_temp.poke_config set gruppi=(gruppi #>> '{}')::jsonb where jsonb_typeof(gruppi)='string'")
    const db = adattaSql(tx)
```
con
```ts
  await adattaPool(() => pool).transazione(async db => {
    await db.query('create temporary table poke_config (like public.poke_config including all) on commit drop')
    await db.query('insert into pg_temp.poke_config select * from public.poke_config')
    // Recupera anche una configurazione di prova salvata dal vecchio driver.
    await db.query("update pg_temp.poke_config set gruppi=(gruppi #>> '{}')::jsonb where jsonb_typeof(gruppi)='string'")
```
e infine `  await sql.end()` con `  await pool.end()`.

- [x] **Step 10: verifiche**
  - `git grep -n "from 'postgres'\|adattaSql"` → **nessun risultato**.
  - `npx vitest run src/server` → **7 test passati, 0 errori non gestiti** («Unhandled Errors» non deve comparire).
  - `npm test` → **40 file, 177 test passati** (173 − 3 vecchi test di `db.test.ts` + 2 nuovi + 5 d'integrazione).
  - `npm run typecheck`, `npm run lint`, `npm run build` → puliti.

- [x] **Step 11: documenta** — in `docs/verifiche/correzioni-tappa-2/README.md`, sezione «Supabase reale», sostituisci il paragrafo che inizia con «La prova reale ha rilevato risultati misassociati» con:

```markdown
La prova reale aveva rilevato risultati misassociati tra letture parallele attraverso il transaction pooler (una query sui conti riceveva colonne di un'altra lettura), con postgres.js che accoda più query sulla stessa connessione. La prima correzione con `reserve()`/`release()` introduceva però un guasto peggiore (revisione PR #3, N1): dopo una caduta della connessione postgres@3.4.9 rimette in uso una connessione morta. Con un server Postgres finto è emerso che anche `sql.begin` lascia inutilizzabile la connessione se cade durante una transazione. Il driver è stato quindi sostituito con `pg` 8.23.0: una query per connessione alla volta, connessioni rotte scartate dal pool, ascoltatori `error` sul pool e sulla connessione in transazione. I test in `src/server/db.integrazione.test.ts` (server finto in `tests/server/postgres-finto.ts`) coprono caduta durante lettura e transazione, rollback, assenza di pipelining e caduta di una connessione inattiva.
```

- [x] **Step 12: (sola lettura) prova sul DB reale** — chiedi all'utente: «Posso eseguire `npx tsx --env-file=.env.local scripts/verifica-poke-postgres.ts`? Crea solo una tabella temporanea dentro una transazione e non modifica dati persistenti.» Solo col suo sì, eseguilo: atteso il messaggio «Poke: round-trip JSON e prezzi verificati con PostgreSQL; nessun dato persistente modificato.»

- [x] **Step 13: commit**

```bash
git add package.json package-lock.json src/server tests/server scripts/assegna-ruolo.ts scripts/verifica-poke-postgres.ts docs/verifiche/correzioni-tappa-2/README.md
git commit -m "Driver pg al posto di postgres.js: connessioni cadute scartate, niente pipelining"
```

---

### Task 2: N2 — Schermo cucina sempre montato, suono e ordini visti che sopravvivono

**File:** `src/domain/arrivi-cucina.ts`, `src/domain/arrivi-cucina.test.ts`, `src/app/staff/InizioTurno.tsx`, `src/app/staff/SchermoStaff.tsx`, `src/app/staff/SchermoStaff.test.tsx`, `src/app/staff/page.tsx`, `src/app/staff/page.test.tsx`

**Interfacce prodotte:** `StatoArrivi`, `arriviCucina(prima, attuali) → { stato, arrivati }`, `segnaLetto`, `leggiStatoArrivi`; `DatiStaff`; `SchermoStaff({ dati: DatiStaff | null, ora })`.

- [ ] **Step 1: test di dominio** — sostituisci **tutto** `src/domain/arrivi-cucina.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { arriviCucina, leggiStatoArrivi, segnaLetto } from './arrivi-cucina'
it('non suona al primo avvio, segnala solo arrivi successivi e non ripete i già visti', () => {
  const primo = arriviCucina(null,['1'])
  expect(primo).toEqual({ stato: { visti: ['1'],nuovi: [] },arrivati: [] })
  const secondo = arriviCucina(primo.stato,['1','2'])
  expect(secondo).toEqual({ stato: { visti: ['1','2'],nuovi: ['2'] },arrivati: ['2'] })
  expect(arriviCucina(secondo.stato,['1','2']).arrivati).toEqual([])
})
it('tiene i nuovi non letti finché sono in cucina e dimentica gli ordini usciti', () => {
  const s = arriviCucina({ visti: ['1','2'],nuovi: ['2'] },['2','3']).stato
  expect(s).toEqual({ visti: ['2','3'],nuovi: ['2','3'] })
  expect(segnaLetto(s,'2')).toEqual({ visti: ['2','3'],nuovi: ['3'] })
  expect(arriviCucina(s,['3']).stato).toEqual({ visti: ['3'],nuovi: ['3'] })
})
it('un ordine arrivato mentre lo schermo era smontato viene segnalato al ritorno', () => {
  const salvato = JSON.stringify(arriviCucina(null,['1']).stato)
  expect(arriviCucina(leggiStatoArrivi(salvato),['1','2']).arrivati).toEqual(['2'])
})
it('ignora valori salvati illeggibili o malformati', () => {
  expect(leggiStatoArrivi(null)).toBeNull()
  expect(leggiStatoArrivi('{')).toBeNull()
  expect(leggiStatoArrivi('{"visti":[1],"nuovi":[]}')).toBeNull()
  expect(leggiStatoArrivi('{"visti":["a"]}')).toBeNull()
  expect(leggiStatoArrivi(JSON.stringify({ visti: Array(501).fill('a'),nuovi: [] }))).toBeNull()
  expect(leggiStatoArrivi('{"visti":["a"],"nuovi":["a"]}')).toEqual({ visti: ['a'],nuovi: ['a'] })
})
```

`npx vitest run src/domain/arrivi-cucina.test.ts` → atteso FAIL.

- [ ] **Step 2: dominio** — sostituisci **tutto** `src/domain/arrivi-cucina.ts` con:

```ts
// Ordini della cucina già mostrati e ordini segnalati come nuovi ma non ancora letti.
export interface StatoArrivi { visti: string[]; nuovi: string[] }
const MASSIMO_ID = 500

/**
 * Confronta gli ordini in cucina con quelli già visti.
 * Con `prima` null (primo avvio in questa scheda) gli ordini presenti contano come già visti, senza suono.
 * Si conservano solo gli ordini ancora in cucina: uno servito o annullato non ci torna più.
 */
export function arriviCucina(prima: StatoArrivi | null, attuali: string[]): { stato: StatoArrivi; arrivati: string[] } {
  if (!prima) return { stato: { visti: [...attuali], nuovi: [] }, arrivati: [] }
  const visti = new Set(prima.visti), ancora = new Set(attuali)
  const arrivati = attuali.filter(id => !visti.has(id))
  return { stato: { visti: [...attuali], nuovi: [...prima.nuovi.filter(id => ancora.has(id)), ...arrivati] }, arrivati }
}

export function segnaLetto(stato: StatoArrivi, id: string): StatoArrivi {
  return { ...stato, nuovi: stato.nuovi.filter(x => x !== id) }
}

export function leggiStatoArrivi(testo: string | null): StatoArrivi | null {
  if (!testo) return null
  const lista = (x: unknown): x is string[] => Array.isArray(x) && x.length <= MASSIMO_ID && x.every(id => typeof id === 'string')
  try {
    const v: unknown = JSON.parse(testo)
    if (v && typeof v === 'object' && 'visti' in v && 'nuovi' in v && lista(v.visti) && lista(v.nuovi)) return { visti: v.visti, nuovi: v.nuovi }
  } catch { /* Valore illeggibile: si riparte come a inizio turno. */ }
  return null
}
```

`npx vitest run src/domain/arrivi-cucina.test.ts` → **4 passati**.

- [ ] **Step 3: audio condiviso** — in `src/app/staff/InizioTurno.tsx` applica queste sostituzioni (ciascun «prima» compare una volta sola):

(a) prima:
```tsx
export const SuonoTurno = createContext<(ripetizioni?: number) => void>(() => {})
export function InizioTurno({ children }: { children: React.ReactNode }) {
  const [iniziato,setIniziato] = useState(false)
  const [audioAttivo,setAudioAttivo] = useState(false)
  const [avviso,setAvviso] = useState<string | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const lock = useRef<WakeLockSentinel | null>(null)
  const suona = useCallback((ripetizioni = 1) => {
    const ctx = audio.current
```
dopo:
```tsx
export const SuonoTurno = createContext<(ripetizioni?: number) => void>(() => {})
// Il contesto audio vive quanto la pagina del browser, non quanto il componente: se lo schermo
// viene rimontato (navigazione nell'area staff, errore temporaneo) il suono resta attivo.
let audioCondiviso: AudioContext | null = null
export function InizioTurno({ children }: { children: React.ReactNode }) {
  const [iniziato,setIniziato] = useState(false)
  // Sul server e alla prima idratazione audioCondiviso è null: nessuna differenza tra HTML e client.
  const [audioAttivo,setAudioAttivo] = useState(() => audioCondiviso?.state === 'running')
  const [avviso,setAvviso] = useState<string | null>(null)
  const lock = useRef<WakeLockSentinel | null>(null)
  const suona = useCallback((ripetizioni = 1) => {
    const ctx = audioCondiviso
```

(b) prima:
```tsx
    return () => { const ctx = audio.current; if (ctx) { ctx.onstatechange = null; if (ctx.state!=='closed') void ctx.close().catch(() => {}) } }
```
dopo:
```tsx
    const ctx = audioCondiviso
    if (ctx) ctx.onstatechange = () => setAudioAttivo(ctx.state==='running')
    // Il contesto non si chiude allo smontaggio: lo riprende il prossimo montaggio.
    return () => { if (ctx) ctx.onstatechange = null }
```

(c) prima: `if (audio.current?.state !== 'running') setAudioAttivo(false)` — dopo: `if (audioCondiviso?.state !== 'running') setAudioAttivo(false)`

(d) prima:
```tsx
      if (!audio.current || audio.current.state==='closed') audio.current = new AudioContext()
      const ctx = audio.current
```
dopo:
```tsx
      if (!audioCondiviso || audioCondiviso.state==='closed') audioCondiviso = new AudioContext()
      const ctx = audioCondiviso
```

Dopo le modifiche `grep -n "audio\.current\|const audio" src/app/staff/InizioTurno.tsx` → nessun risultato.

- [ ] **Step 4: SchermoStaff** — in `src/app/staff/SchermoStaff.tsx`:

(a) prima: `import { arriviCucina } from '@/domain/arrivi-cucina'` — dopo: `import { arriviCucina, leggiStatoArrivi, segnaLetto, type StatoArrivi } from '@/domain/arrivi-cucina'`

(b) prima:
```tsx
export function SchermoStaff({ tavoli,ordini,riepiloghi,contiRecenti,ora }: { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[]; ora: string }) {
  const [errore,setErrore] = useState<string | null>(null)
  const [nuovi,setNuovi] = useState<Set<string>>(new Set())
  const visti = useRef<Set<string> | null>(null)
  const [inCorso,startTransition] = useTransition()
  const bloccato = useRef(false)
  const router = useRouter(), suona = useContext(SuonoTurno)
  useEffect(() => {
    const arrivi = arriviCucina(visti.current,ordini.map(o => o.id))
    const nuoviIds = arrivi.nuovi
    visti.current = arrivi.visti
    if (nuoviIds.length) {
      setNuovi(s => new Set([...s,...nuoviIds])); suona(3)
    }
  },[ordini,suona])
  const leggi = (id: string) => setNuovi(s => { const prossimi = new Set(s); prossimi.delete(id); return prossimi })
```
dopo:
```tsx
export interface DatiStaff { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[] }
const CHIAVE_ARRIVI = 'ds_arrivi_cucina'
function arriviSalvati(): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(CHIAVE_ARRIVI)) } catch { return null }
}
function salvaArrivi(stato: StatoArrivi) {
  try { sessionStorage.setItem(CHIAVE_ARRIVI,JSON.stringify(stato)) } catch { /* Senza storage la memoria resta solo in questa pagina. */ }
}
export function SchermoStaff({ dati,ora }: { dati: DatiStaff | null; ora: string }) {
  // Se una lettura dal database fallisce lo schermo resta montato con gli ultimi dati ricevuti:
  // smontarlo azzererebbe il suono e la memoria degli ordini già visti.
  const [ultimi,setUltimi] = useState(dati)
  if (dati && dati !== ultimi) setUltimi(dati)
  const mostrati = dati ?? ultimi
  const ordini = mostrati?.ordini
  const [errore,setErrore] = useState<string | null>(null)
  const [nuovi,setNuovi] = useState<string[]>([])
  // undefined = non ancora letto da sessionStorage; null = primo avvio del turno in questa scheda.
  const arrivi = useRef<StatoArrivi | null | undefined>(undefined)
  const [inCorso,startTransition] = useTransition()
  const bloccato = useRef(false)
  const router = useRouter(), suona = useContext(SuonoTurno)
  useEffect(() => {
    if (!ordini) return
    if (arrivi.current === undefined) arrivi.current = arriviSalvati()
    const { stato,arrivati } = arriviCucina(arrivi.current,ordini.map(o => o.id))
    arrivi.current = stato; salvaArrivi(stato)
    setNuovi(stato.nuovi)
    if (arrivati.length) suona(3)
  },[ordini,suona])
  const leggi = (id: string) => {
    if (!arrivi.current) return
    arrivi.current = segnaLetto(arrivi.current,id); salvaArrivi(arrivi.current)
    setNuovi(arrivi.current.nuovi)
  }
```

(c) prima:
```tsx
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
```
dopo:
```tsx
  if (!mostrati || !ordini) return <p role="status">Caricamento dello schermo…</p>
  const { tavoli,riepiloghi,contiRecenti } = mostrati
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
```

(d) prima: `nuovo={nuovi.has(o.id)}` — dopo: `nuovo={nuovi.includes(o.id)}`

- [ ] **Step 5: pagina staff** — in `src/app/staff/page.tsx`. Attenzione: anche il ruolo (`richiediRuolo` → `leggiRuolo`) si legge dal DB. Se il DB è giù fallisce per primo quello e, senza questa modifica, Next mostrerebbe `error.tsx` smontando tutto lo schermo: il caso più comune di guasto resterebbe scoperto.

(0a) prima: `import { richiediRuolo } from '@/auth/sessione'` — dopo:
```tsx
import { unstable_rethrow } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
```

(0b) prima:
```tsx
  await richiediRuolo('staff')
  let dati = null
  try { dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)]) }
  catch (err) { console.error(err instanceof Error ? err.message : 'errore sconosciuto') }
```
dopo:
```tsx
  let dati = null
  try {
    // Anche il ruolo si legge dal DB: se il DB non risponde lo schermo resta montato con gli ultimi
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)])
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
```
(`unstable_rethrow` è documentato in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`.)

(a) prima:
```tsx
  const ora = new Date().toISOString()
  return (
```
dopo:
```tsx
  const ora = new Date().toISOString()
  const datiStaff = dati ? {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
  } : null
  return (
```

(b) sostituisci l'intera riga che inizia con `      {dati ? <InizioTurno><SchermoStaff ora={ora} tavoli=` (termina con `riprovo da solo…</p>}`) con:
```tsx
      {!dati && <p role="status" className="staff-nota">Database non raggiungibile, riprovo da solo… Lo schermo mostra gli ultimi dati ricevuti.</p>}
      {/* Sempre montati, anche se la lettura fallisce: suono e ordini già visti non si perdono. */}
      <InizioTurno><SchermoStaff ora={ora} dati={datiStaff} /></InizioTurno>
```

- [ ] **Step 6: test dei componenti**

In `src/app/staff/page.test.tsx`:

(i) sostituisci:
```tsx
vi.mock('next/navigation',() => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import AreaStaff from './page'
```
con
```tsx
vi.mock('next/navigation',async originale => ({ ...await originale<typeof import('next/navigation')>(),useRouter: () => ({ refresh: vi.fn() }) }))
import { redirect } from 'next/navigation'
import AreaStaff from './page'
```

(ii) sostituisci:
```tsx
it('i redirect del ruolo propagano senza essere convertiti in errori DB', async () => {
  m.ruolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(AreaStaff()).rejects.toThrow('NEXT_REDIRECT')
  expect(m.elenco).not.toHaveBeenCalled()
})
```
con (ora serve un vero redirect di Next, perché `unstable_rethrow` riconosce solo quelli):
```tsx
it('i redirect del ruolo propagano senza essere convertiti in errori DB', async () => {
  m.ruolo.mockImplementationOnce(async () => redirect('/accesso'))
  await expect(AreaStaff()).rejects.toThrow('NEXT_REDIRECT')
  expect(m.elenco).not.toHaveBeenCalled()
})
it('se il DB non risponde nemmeno per il ruolo resta lo schermo, senza leggere dati', async () => {
  m.ruolo.mockRejectedValueOnce(new Error('DB giù'))
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).toContain('Database non raggiungibile, riprovo da solo'); expect(html).toContain('Inizia turno')
  expect(m.elenco).not.toHaveBeenCalled()
})
```

(iii) sostituisci:
```tsx
  expect(html).toContain('Area staff'); expect(html).toContain('Database non raggiungibile, riprovo da solo')
})
```
con
```tsx
  expect(html).toContain('Area staff'); expect(html).toContain('Database non raggiungibile, riprovo da solo')
  // InizioTurno resta montato anche quando la lettura fallisce.
  expect(html).toContain('Inizia turno')
})
it('con i dati letti non mostra il banner di errore', async () => {
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).not.toContain('Database non raggiungibile'); expect(html).toContain('Inizia turno')
})
```

In fondo a `src/app/staff/SchermoStaff.test.tsx` aggiungi:
```tsx
it('senza dati e senza dati precedenti mostra il caricamento invece di smontarsi', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  expect(renderToStaticMarkup(<SchermoStaff dati={null} ora="2026-10-11T18:05:00Z" />)).toContain('Caricamento dello schermo')
  const html = renderToStaticMarkup(<SchermoStaff dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [] }} ora="2026-10-11T18:05:00Z" />)
  expect(html).toContain('Cucina'); expect(html).toContain('Nessun tavolo configurato')
})
```

- [ ] **Step 7: verifiche** — `npx vitest run src/app/staff src/domain/arrivi-cucina.test.ts` tutti verdi; `npm run typecheck`; `npm run lint`.

- [ ] **Step 8: commit** — `git add src/domain/arrivi-cucina.ts src/domain/arrivi-cucina.test.ts src/app/staff/InizioTurno.tsx src/app/staff/SchermoStaff.tsx src/app/staff/SchermoStaff.test.tsx src/app/staff/page.tsx src/app/staff/page.test.tsx && git commit -m "Cucina sempre montata: ultimi dati, suono condiviso e ordini visti salvati nella scheda"`

---

### Task 3: Minor 9 — Niente aggiornamenti accumulati mentre uno è in corso

**File:** `src/domain/connessione.ts`, `src/domain/connessione.test.ts`, `src/componenti/AggiornamentoAutomatico.tsx`

- [ ] **Step 1: test** — in `src/domain/connessione.test.ts` cambia l'import `import { prossimoStatoConnessione, verificaConnessione } from './connessione'` in `import { prossimoStatoConnessione, verificaConnessione, puoAggiornare } from './connessione'` e aggiungi in fondo:

```ts
it('non accoda aggiornamenti mentre uno è in corso, salvo dopo 30 secondi', () => {
  expect(puoAggiornare(null,1000)).toBe(true)
  expect(puoAggiornare(1000,1000 + 29_999)).toBe(false)
  expect(puoAggiornare(1000,1000 + 30_000)).toBe(true)
})
```
Esegui → FAIL.

- [ ] **Step 2: dominio** — aggiungi in fondo a `src/domain/connessione.ts`:

```ts
// Un aggiornamento della pagina ancora in corso blocca il successivo, ma non per sempre:
// se dopo 30 secondi non è finito si riprova comunque.
export const ATTESA_MASSIMA_AGGIORNAMENTO_MS = 30_000
export function puoAggiornare(inizioInCorso: number | null, ora: number): boolean {
  return inizioInCorso === null || ora - inizioInCorso >= ATTESA_MASSIMA_AGGIORNAMENTO_MS
}
```

- [ ] **Step 3: componente** — in `src/componenti/AggiornamentoAutomatico.tsx`:

(a) `import { useEffect, useRef, useState } from 'react'` → `import { useEffect, useRef, useState, useTransition } from 'react'`

(b) `import { prossimoStatoConnessione, verificaConnessione, type StatoConnessione } from '@/domain/connessione'` → `import { prossimoStatoConnessione, puoAggiornare, verificaConnessione, type StatoConnessione } from '@/domain/connessione'`

(c) dopo la riga `  useEffect(() => { ultimo.current = ultimoAggiornamento },[ultimoAggiornamento])` aggiungi:
```tsx
  // router.refresh() dentro una transizione: isPending resta vero finché la pagina aggiornata non arriva.
  const [aggiornando,startTransition] = useTransition()
  const inizioAggiornamento = useRef<number | null>(null)
  useEffect(() => { if (!aggiornando) inizioAggiornamento.current = null },[aggiornando])
```

(d) `      if (occupato || document.visibilityState !== 'visible') return` → `      if (occupato || document.visibilityState !== 'visible' || !puoAggiornare(inizioAggiornamento.current,Date.now())) return`

(e) `      if (ok) router.refresh()` → `      if (ok) { inizioAggiornamento.current = Date.now(); startTransition(() => router.refresh()) }`

- [ ] **Step 4:** `npx vitest run src/domain/connessione.test.ts` verde; `npm run typecheck`; `npm run lint`.
- [ ] **Step 5: commit** — `git add src/domain/connessione.ts src/domain/connessione.test.ts src/componenti/AggiornamentoAutomatico.tsx && git commit -m "Aggiornamento automatico: niente refresh accumulati mentre uno è in corso"`

---

### Task 4: N3 — Il conto ricorda cosa ha visto il cameriere

**File:** `src/tavoli/ordini-repo.ts`, `src/tavoli/ordini-repo.test.ts`, crea `src/app/staff/ChiusuraConto.tsx` e `src/app/staff/ChiusuraConto.test.tsx`, modifica `src/app/staff/conto/[sessione]/page.tsx`

**Interfacce prodotte:** `Conto.ordiniIds: string[]`; `RiferimentoConto`; `ChiusuraConto({ sessioneId, attuale })`; `AvvisoContoCambiato({ base, attuale, ricontrollato })`.

- [ ] **Step 1: test del repository** — in `src/tavoli/ordini-repo.test.ts`, nel test `'un ordine arrivato dopo il conto richiede conferma anche se è già servito'`, sostituisci:
```ts
  await avanzaStato(db,e.ordine.id); await avanzaStato(db,e.ordine.id)
  expect(await chiudiSessione(db,sessione,conto.vistoAlle)).toEqual({ ok: false,motivo: 'ordini_dopo_conto',n: 1 })
  expect(await chiudiSessione(db,sessione,conto.vistoAlle,true)).toEqual({ ok: true })
})
```
con
```ts
  await avanzaStato(db,e.ordine.id); await avanzaStato(db,e.ordine.id)
  // La pagina si aggiorna da sola: il nuovo ordine compare negli ordini del conto...
  const aggiornato = (await contoSessione(db,sessione))!
  expect(aggiornato.ordiniIds.filter(id => !conto.ordiniIds.includes(id))).toEqual([e.ordine.id])
  // ...ma la chiusura usa ancora l'ora del primo conto visto dal cameriere.
  expect(await chiudiSessione(db,sessione,conto.vistoAlle)).toEqual({ ok: false,motivo: 'ordini_dopo_conto',n: 1 })
  expect(await chiudiSessione(db,sessione,aggiornato.vistoAlle)).toEqual({ ok: true })
})
```
Esegui `npx vitest run src/tavoli/ordini-repo.test.ts` → FAIL (`ordiniIds` non esiste) o errore di tipo.

- [ ] **Step 2: repository** — in `src/tavoli/ordini-repo.ts`:

prima:
```ts
export interface Conto { tavoloNome: string; apertaIl: Date; chiusaIl: Date | null; vistoAlle: Date; voci: (IdentitaVoce & { quantita: number; importoCent: number })[]; totaleCent: number }
```
dopo:
```ts
// ordiniIds: ordini non annullati del conto, per riconoscere quelli arrivati dopo l'apertura della pagina.
export interface Conto { tavoloNome: string; apertaIl: Date; chiusaIl: Date | null; vistoAlle: Date; voci: (IdentitaVoce & { quantita: number; importoCent: number })[]; totaleCent: number; ordiniIds: string[] }
```
prima:
```ts
  return { ...s,vistoAlle,voci,totaleCent: voci.reduce((s,r) => s + r.importoCent,0) }
```
dopo:
```ts
  const ordini = await tx.query<{ id: string }>("select id from ordini where sessione_id=$1 and stato<>'annullato' order by creato_il,id",[sessioneId])
  return { ...s,vistoAlle,voci,totaleCent: voci.reduce((s,r) => s + r.importoCent,0),ordiniIds: ordini.map(o => o.id) }
```
Riesegui → verde.

- [ ] **Step 3: test del componente** — crea `src/app/staff/ChiusuraConto.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(),refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ chiudiTavolo: vi.fn() }))
import { AvvisoContoCambiato, ChiusuraConto } from './ChiusuraConto'
const base = { vistoAlle: '2026-10-11T20:00:00.000Z',ordiniIds: ['a'],totaleCent: 2100 }
it('nessun avviso se non sono arrivati ordini nuovi, anche se il totale è sceso', () => {
  expect(renderToStaticMarkup(<AvvisoContoCambiato base={base} attuale={{ ...base,vistoAlle: '2026-10-11T20:00:10.000Z',totaleCent: 1500 }} ricontrollato={() => {}} />)).toBe('')
})
it('segnala gli ordini arrivati dopo l’apertura del conto con il vecchio e il nuovo totale', () => {
  const html = renderToStaticMarkup(<AvvisoContoCambiato base={base} attuale={{ vistoAlle: '2026-10-11T20:00:10.000Z',ordiniIds: ['a','b'],totaleCent: 3300 }} ricontrollato={() => {}} />)
  expect(html).toContain('È arrivato 1 nuovo ordine'); expect(html).toContain('21,00'); expect(html).toContain('33,00'); expect(html).toContain('Ho ricontrollato il conto')
})
it('al primo render il riferimento è il conto attuale e la chiusura resta il bottone distruttivo', () => {
  const html = renderToStaticMarkup(<ChiusuraConto sessioneId="s" attuale={base} />)
  expect(html).not.toContain('nuovo ordine'); expect(html).toContain('ds-btn--destructive'); expect(html).toContain('Chiudi tavolo')
})
```

- [ ] **Step 4: componente** — crea `src/app/staff/ChiusuraConto.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { ChiudiTavolo } from './ChiudiTavolo'

export interface RiferimentoConto { vistoAlle: string; ordiniIds: string[]; totaleCent: number }

export function AvvisoContoCambiato({ base,attuale,ricontrollato }: { base: RiferimentoConto; attuale: RiferimentoConto; ricontrollato: () => void }) {
  const n = attuale.ordiniIds.filter(id => !base.ordiniIds.includes(id)).length
  if (!n) return null
  return <div role="status" className="staff-nota">
    <p>{n === 1 ? 'È arrivato 1 nuovo ordine' : `Sono arrivati ${n} nuovi ordini`} da quando hai aperto il conto: il totale è passato da {formatEuro(base.totaleCent)} a {formatEuro(attuale.totaleCent)}. Ricontrolla prima di battere in cassa.</p>
    <button type="button" className="ds-btn ds-btn--secondary" onClick={ricontrollato}>Ho ricontrollato il conto</button>
  </div>
}

// Il riferimento è il conto che il cameriere aveva davanti quando ha aperto la pagina.
// L'aggiornamento automatico ogni 10 secondi non lo sposta: gli ordini arrivati nel frattempo
// restano segnalati qui e fanno scattare la conferma alla chiusura.
export function ChiusuraConto({ sessioneId,attuale }: { sessioneId: string; attuale: RiferimentoConto }) {
  const [base,setBase] = useState(attuale)
  return <div className="staff-navigazione">
    <AvvisoContoCambiato base={base} attuale={attuale} ricontrollato={() => setBase(attuale)} />
    <ChiudiTavolo sessioneId={sessioneId} contoVistoAlle={base.vistoAlle} primaria />
  </div>
}
```

- [ ] **Step 5: pagina del conto** — in `src/app/staff/conto/[sessione]/page.tsx`:
  - `import { ChiudiTavolo } from '../../ChiudiTavolo'` → `import { ChiusuraConto } from '../../ChiusuraConto'`
  - la riga `    {!conto.chiusaIl && <div className="staff-navigazione"><ChiudiTavolo sessioneId={sessione} contoVistoAlle={conto.vistoAlle.toISOString()} primaria /></div>}` → `    {!conto.chiusaIl && <ChiusuraConto sessioneId={sessione} attuale={{ vistoAlle: conto.vistoAlle.toISOString(),ordiniIds: conto.ordiniIds,totaleCent: conto.totaleCent }} />}`

**Non** modificare `ChiudiTavolo.tsx`: resta usato anche dalle card dei tavoli.

- [ ] **Step 6:** `npx vitest run src/app/staff src/tavoli/ordini-repo.test.ts` verde; `npm run typecheck`; `npm run lint`.
- [ ] **Step 7: commit** — `git add src/tavoli/ordini-repo.ts src/tavoli/ordini-repo.test.ts src/app/staff/ChiusuraConto.tsx src/app/staff/ChiusuraConto.test.tsx "src/app/staff/conto/[sessione]/page.tsx" && git commit -m "Conto: riferimento fisso per la chiusura e avviso sui nuovi ordini arrivati"`

---

### Task 5: N4 + Minor 2 — Tentativi per rete, niente secchio «sconosciuto», tetto per sessione per tutti

**File:** `src/domain/ip-client.ts`, `src/domain/ip-client.test.ts`, `src/domain/limiti-tentativi.ts`, `src/domain/limiti-tentativi.test.ts`, `src/tavoli/repo.ts`, `src/tavoli/repo.test.ts`, `src/app/tavolo/[chiave]/azioni.test.ts`, `src/app/staff/SchermoStaff.tsx`

- [ ] **Step 1: test** — sostituisci **tutto** `src/domain/ip-client.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { ipDaHeaders, reteDaIp } from './ip-client'
it('usa il primo IP inoltrato, ripiega su real-ip e restituisce null se manca', () => {
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' 192.0.2.1, 10.0.0.1','x-real-ip': '192.0.2.2' }))).toBe('192.0.2.1')
  expect(ipDaHeaders(new Headers({ 'x-real-ip': ' 2001:db8::1 ' }))).toBe('2001:db8:0:0::/64')
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': ' ,' }))).toBeNull()
  expect(ipDaHeaders(new Headers())).toBeNull()
  expect(ipDaHeaders(new Headers({ 'x-forwarded-for': 'non-un-ip' }))).toBeNull()
})
it('raggruppa IPv6 per rete /64 e riconosce IPv4 incapsulato', () => {
  expect(reteDaIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64')
  expect(reteDaIp('2001:DB8:1:2::99')).toBe('2001:db8:1:2::/64')
  expect(reteDaIp('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
  expect(reteDaIp('::1')).toBe('0:0:0:0::/64')
  expect(reteDaIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
  expect(reteDaIp('::ffff:192.0.2.7')).toBe('192.0.2.7')
  expect(reteDaIp('2001:db8::192.0.2.7')).toBe('2001:db8:0:0::/64')
  expect(reteDaIp('192.0.2.300')).toBeNull()
})
```

e **tutto** `src/domain/limiti-tentativi.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { bloccato } from './limiti-tentativi'
it('blocca dispositivo o rete a cinque errori e tutti i nuovi accessi a trenta per sessione', () => {
  expect(bloccato({ dispositivo: 4,ip: 4,sessione: 29 })).toBe(false)
  expect(bloccato({ dispositivo: 5,ip: 0,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 5,sessione: 5 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 30 })).toBe(true)
  expect(bloccato({ dispositivo: 0,ip: 0,sessione: 29 })).toBe(false)
})
```
Esegui `npx vitest run src/domain/ip-client.test.ts src/domain/limiti-tentativi.test.ts` → FAIL.

- [ ] **Step 2: dominio** — sostituisci **tutto** `src/domain/ip-client.ts` con:

```ts
import { isIP } from 'node:net'

// Chiave con cui contare i tentativi per indirizzo, o null se l'indirizzo manca o non è valido:
// in quel caso si conta solo per dispositivo e sessione, invece di mettere tutti nello stesso secchio.
export function ipDaHeaders(h: Pick<Headers,'get'>): string | null {
  return reteDaIp(h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip')?.trim() || '')
}

export function reteDaIp(ip: string): string | null {
  const indirizzo = ip.split('%')[0].toLowerCase()
  const tipo = isIP(indirizzo)
  if (tipo === 4) return indirizzo
  if (tipo !== 6) return null
  const g = gruppiIpv6(indirizzo)
  // IPv4 incapsulato in IPv6 (::ffff:a.b.c.d): si conta come l'indirizzo IPv4.
  if (g.slice(0,5).every(x => x === 0) && g[5] === 0xffff) return [g[6] >> 8,g[6] & 255,g[7] >> 8,g[7] & 255].join('.')
  // Una rete /64 è di solito una sola casa o un solo server, e chi la usa può cambiare a piacere
  // le ultime 64 cifre binarie: si conta per rete, non per singolo indirizzo.
  return `${g.slice(0,4).map(x => x.toString(16)).join(':')}::/64`
}

// Gli otto gruppi da 16 bit di un indirizzo IPv6 già validato da isIP.
function gruppiIpv6(ip: string): number[] {
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  const testo = v4 ? `${ip.slice(0,v4.index)}${((+v4[1] << 8) | +v4[2]).toString(16)}:${((+v4[3] << 8) | +v4[4]).toString(16)}` : ip
  const [sinistra,destra] = testo.split('::')
  const sx = sinistra ? sinistra.split(':') : [], dx = destra ? destra.split(':') : []
  const zeri = destra === undefined ? 0 : 8 - sx.length - dx.length
  return [...sx,...Array<string>(zeri).fill('0'),...dx].map(x => parseInt(x,16))
}
```

e **tutto** `src/domain/limiti-tentativi.ts` con:

```ts
export const LIMITE_DISPOSITIVO = 5
export const LIMITE_SESSIONE = 30
export const FINESTRA_MINUTI = 10
export interface ErroriCodice { dispositivo: number; ip: number; sessione: number }
// Oltre LIMITE_SESSIONE errori sulla sessione si blocca chiunque non sia già entrato, anche un
// dispositivo o una rete mai visti: chi ha il QR non può provare tutti i codici cambiando indirizzo.
// I clienti già seduti non passano di qui; il personale ha «Sblocca» e «Nuovo QR».
export function bloccato(e: ErroriCodice): boolean {
  return e.dispositivo >= LIMITE_DISPOSITIVO || e.ip >= LIMITE_DISPOSITIVO || e.sessione >= LIMITE_SESSIONE
}
```

- [ ] **Step 3: repository** — in `src/tavoli/repo.ts`:

prima:
```ts
export async function registraTentativoFallito(db: Db, d: { tavoloId: string; sessioneId: string; dispositivo: string; ip: string }): Promise<void> {
  if (!idValido(d.tavoloId) || !idValido(d.sessioneId) || !idValido(d.dispositivo) || typeof d.ip !== 'string') return
```
dopo:
```ts
// ip è la rete restituita da ipDaHeaders, o null se l'indirizzo non è noto.
export async function registraTentativoFallito(db: Db, d: { tavoloId: string; sessioneId: string; dispositivo: string; ip: string | null }): Promise<void> {
  if (!idValido(d.tavoloId) || !idValido(d.sessioneId) || !idValido(d.dispositivo) || (d.ip !== null && typeof d.ip !== 'string')) return
```
prima:
```ts
export async function contaErrori(db: Db, d: { sessioneId: string; dispositivo: string; ip: string; minuti: number }): Promise<ErroriCodice> {
  if (!idValido(d.sessioneId) || !idValido(d.dispositivo) || typeof d.ip !== 'string' || !Number.isSafeInteger(d.minuti) || d.minuti<1) return { dispositivo: 0,ip: 0,sessione: 0 }
```
dopo:
```ts
export async function contaErrori(db: Db, d: { sessioneId: string; dispositivo: string; ip: string | null; minuti: number }): Promise<ErroriCodice> {
  if (!idValido(d.sessioneId) || !idValido(d.dispositivo) || (d.ip !== null && typeof d.ip !== 'string') || !Number.isSafeInteger(d.minuti) || d.minuti<1) return { dispositivo: 0,ip: 0,sessione: 0 }
```
La query SQL di `contaErrori` **non cambia**: con `ip` null il filtro `ip=$3` non conta nulla, che è il comportamento voluto. La colonna `tentativi_codice.ip` accetta già null: **nessuna migrazione**.

- [ ] **Step 4: test del repository** — in `src/tavoli/repo.test.ts`, subito dopo la chiusura `})` del test `'limite end-to-end su repo reale: dispositivo, IP, finestra, sblocco e riapertura'`, aggiungi:

```ts
it('senza indirizzo conta solo dispositivo e sessione; a trenta errori blocca anche chi è nuovo', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'B', 'b'), s = await apriSessione(db,t.id)
  for (let i=0; i<5; i++) await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo: randomUUID(),ip: null })
  // Cinque telefoni senza indirizzo non bloccano un sesto telefono senza indirizzo.
  expect(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: null,minuti: 10 })).toEqual({ dispositivo: 0,ip: 0,sessione: 5 })
  for (let i=0; i<25; i++) await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo: randomUUID(),ip: `2001:db8:${i}:0::/64` })
  expect(bloccato(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: '2001:db8:ff:0::/64',minuti: 10 }))).toBe(true)
  await sbloccaSessione(db,s.id)
  expect(bloccato(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: null,minuti: 10 }))).toBe(false)
})
```
(`randomUUID`, `bloccato` e `sbloccaSessione` sono già importati in quel file.)

- [ ] **Step 5: test dell'azione** — in `src/app/tavolo/[chiave]/azioni.test.ts` sostituisci `{ dispositivo: 0, ip: 1, sessione: 30 }` con `{ dispositivo: 0, ip: 0, sessione: 30 }` (il caso ora prova che il tetto vale anche per chi non ha mai sbagliato). `src/app/tavolo/[chiave]/azioni.ts` **non va modificato**: `ipDaHeaders` ora restituisce `string | null` e i tipi del repository lo accettano.

- [ ] **Step 6: card staff** — in `src/app/staff/SchermoStaff.tsx`:
  - dopo `import { formatEuro } from '@/domain/soldi'` aggiungi la riga `import { LIMITE_SESSIONE } from '@/domain/limiti-tentativi'`
  - sostituisci `<p>{s.tentativi} tentativi sbagliati</p>` con `<p>{s.tentativi} tentativi sbagliati{s.tentativi >= LIMITE_SESSIONE && ': nessun nuovo telefono può entrare finché non sblocchi'}</p>`

- [ ] **Step 7:** `npx vitest run src/domain src/tavoli/repo.test.ts src/app/tavolo src/app/staff` verde; `npm run typecheck`; `npm run lint`.
- [ ] **Step 8: commit** — `git add src/domain/ip-client.ts src/domain/ip-client.test.ts src/domain/limiti-tentativi.ts src/domain/limiti-tentativi.test.ts src/tavoli/repo.ts src/tavoli/repo.test.ts "src/app/tavolo/[chiave]/azioni.test.ts" src/app/staff/SchermoStaff.tsx && git commit -m "Tentativi per rete /64, niente IP condiviso «sconosciuto», tetto di sessione per tutti"`

---

### Task 6: Rifiniture (Minor 3, 5, 10, 11, 12) e nome della prima migrazione

**File:** `src/domain/origine-app.ts`, `src/domain/origine-app.test.ts`, `src/app/admin/tavoli/page.tsx`, `src/app/admin/tavoli/ModuloTavolo.tsx`, `src/app/tavolo/[chiave]/Carrello.tsx`, `src/app/tavolo/[chiave]/page.tsx`, `src/app/tavolo/[chiave]/ModuloCodice.tsx`, `src/app/tavolo/[chiave]/componenti.test.tsx`, `supabase/migrations/20261011120000_menu_e_ruoli.sql` (solo rinomina), `docs/verifiche/correzioni-tappa-2/README.md`

- [ ] **Step 1 (Minor 10): `origineApp`** — in `src/domain/origine-app.ts` sostituisci:
```ts
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() || (locale ? 'http' : 'https')
```
con
```ts
  // Solo http o https: qualunque altro valore inoltrato viene ignorato.
  const inoltrato = h.get('x-forwarded-proto')?.split(',')[0].trim().toLowerCase()
  const proto = inoltrato === 'http' || inoltrato === 'https' ? inoltrato : locale ? 'http' : 'https'
```
In fondo a `src/domain/origine-app.test.ts` aggiungi:
```ts
it('ignora un x-forwarded-proto diverso da http o https', () => {
  expect(origineApp(new Headers({ host: 'ordini.example','x-forwarded-proto': 'javascript' }))).toBe('https://ordini.example')
  expect(origineApp(new Headers({ host: 'localhost:3000','x-forwarded-proto': 'ftp' }))).toBe('http://localhost:3000')
})
```

- [ ] **Step 2 (Minor 10): pagina tavoli admin** — in `src/app/admin/tavoli/page.tsx` sostituisci:
```tsx
  const origin = origineApp(await headers(),process.env.APP_URL)
  const tavoli = await elencoTavoli(db)
  return <><h1 className="heading">Tavoli</h1><p>Il QR resta lo stesso a ogni apertura. Il cameriere comunica il nuovo codice.</p><Link href="/admin/tavoli/stampa" className="ds-btn ds-btn--secondary">Stampa i QR</Link>
    <ModuloTavolo /><div className="admin-tavoli">{tavoli.map(t => <ModuloTavolo key={t.id} tavolo={{ id: t.id,nome: t.nome,slug: t.slug,chiave: t.chiave,posizione: t.posizione,attivo: t.attivo }} url={`${origin}/tavolo/${t.chiave}`} />)}</div></>
```
con
```tsx
  // Un APP_URL sbagliato non deve impedire di gestire i tavoli: si nascondono solo i link.
  let origin: string | null = null
  try { origin = origineApp(await headers(),process.env.APP_URL) } catch { /* Avviso sotto. */ }
  const tavoli = await elencoTavoli(db)
  return <><h1 className="heading">Tavoli</h1><p>Il QR resta lo stesso a ogni apertura. Il cameriere comunica il nuovo codice.</p><Link href="/admin/tavoli/stampa" className="ds-btn ds-btn--secondary">Stampa i QR</Link>
    {!origin && <p className="admin-avviso">APP_URL non valido: correggilo per vedere e stampare i link dei QR.</p>}
    <ModuloTavolo /><div className="admin-tavoli">{tavoli.map(t => <ModuloTavolo key={t.id} tavolo={{ id: t.id,nome: t.nome,slug: t.slug,chiave: t.chiave,posizione: t.posizione,attivo: t.attivo }} url={origin ? `${origin}/tavolo/${t.chiave}` : undefined} />)}</div></>
```
La pagina di stampa (`stampa/page.tsx`) **resta com'è**: lì un `APP_URL` non valido deve continuare a fermare la stampa.

- [ ] **Step 3 (Minor 5): conferma «Nuovo QR»** — in `src/app/admin/tavoli/ModuloTavolo.tsx` sostituisci:
```tsx
    {tavolo && <><p><a className="ds-link" href={url}>{url}</a></p><ConfermaAzione inCorso={qrInCorso || inCorso} domanda="I QR stampati di questo tavolo smetteranno di funzionare. Generare un nuovo QR?"
```
con
```tsx
    {tavolo && <>{url && <p><a className="ds-link" href={url}>{url}</a></p>}<ConfermaAzione inCorso={qrInCorso || inCorso} domanda="I QR stampati di questo tavolo smetteranno di funzionare e i clienti seduti dovranno scansionare il nuovo QR. Generare un nuovo QR?"
```

- [ ] **Step 4 (Minor 12): poke da ricomporre senza prezzo finto** — in `src/app/tavolo/[chiave]/Carrello.tsx`:
  - `        <h3>{r.nome} · {formatEuro(r.prezzoCent * r.quantita)}</h3>` → `        <h3>{r.nome} · {r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</h3>`
  - `      <p>Totale stimato: <strong>{formatEuro(totale)}</strong>. Il prezzo viene verificato all’invio.</p>` → `      <p>Totale stimato: <strong>{formatEuro(totale)}</strong>{righe.some(r => r.daRicomporre) && ' (senza le poke da ricomporre)'}. Il prezzo viene verificato all’invio.</p>`

- [ ] **Step 5 (Minor 3): saluto «tavolo chiuso» solo se il tavolo è ancora chiuso** — in `src/app/tavolo/[chiave]/page.tsx`:
  - `import { tavoloDaChiave, sessionePerId } from '@/tavoli/repo'` → `import { tavoloDaChiave, sessionePerId, sessioneDelTavolo } from '@/tavoli/repo'`
  - dopo la riga che inizia con `  const dati = autorizzata && sessione ? await Promise.all(` aggiungi:
    ```tsx
      // Il saluto «tavolo chiuso» non va mostrato se nel frattempo il tavolo è stato riaperto.
      const tavoloAperto = !autorizzata && !!await sessioneDelTavolo(db,tavolo.id)
    ```
  - `      <ModuloCodice chiave={chiave} pulisci={accesso.pulisci} chiuso={accesso.chiuso} />` → `      <ModuloCodice chiave={chiave} pulisci={accesso.pulisci} chiuso={accesso.chiuso} tavoloAperto={tavoloAperto} />`

  In `src/app/tavolo/[chiave]/ModuloCodice.tsx`:
  - `export function ModuloCodice({ chiave,pulisci = false,chiuso = false }: { chiave: string; pulisci?: boolean; chiuso?: boolean }) {` → `export function ModuloCodice({ chiave,pulisci = false,chiuso = false,tavoloAperto = false }: { chiave: string; pulisci?: boolean; chiuso?: boolean; tavoloAperto?: boolean }) {`
  - `    {(chiuso || eraChiuso) && <p role="status">` → `    {(chiuso || eraChiuso) && !tavoloAperto && <p role="status">`

- [ ] **Step 6: test** — in `src/app/tavolo/[chiave]/componenti.test.tsx`:
  - `vi.mock('./azioni', () => ({ inviaOrdine: vi.fn() }))` → `vi.mock('./azioni', () => ({ inviaOrdine: vi.fn(), entraAlTavolo: vi.fn(), inizializzaDispositivo: vi.fn(), pulisciCookieTavolo: vi.fn() }))`
  - dopo `import { CardPiatto } from './MenuOrdinabile'` aggiungi:
    ```tsx
    import { ModuloCodice } from './ModuloCodice'
    import { Carrello } from './Carrello'
    ```
  - in fondo aggiungi:
    ```tsx
    it('il saluto «tavolo chiuso» sparisce se il tavolo è stato riaperto', () => {
      expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso />)).toContain('Il tavolo è chiuso')
      expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso tavoloAperto />)).not.toContain('Il tavolo è chiuso')
    })
    it('una poke da ricomporre non mostra un prezzo e il totale lo dice', () => {
      const html = renderToStaticMarkup(<Carrello righe={[{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] },nome: 'Poke composta',prezzoCent: 0,daRicomporre: true }]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} />)
      expect(html).toContain('Poke composta · —'); expect(html).toContain('senza le poke da ricomporre'); expect(html).not.toContain('Poke composta · 0,00')
    })
    ```

- [ ] **Step 7: nome della prima migrazione** — il DB reale l'ha registrata come versione `20261011163506`: con il nome attuale un futuro `supabase db push` proverebbe a rieseguirla e fallirebbe.
  ```bash
  git mv supabase/migrations/20261011120000_menu_e_ruoli.sql supabase/migrations/20261011163506_menu_e_ruoli.sql
  ```
  Il contenuto **non** cambia. I test PGlite leggono le migrazioni in ordine di nome: l'ordine resta lo stesso. Non modificare i vecchi documenti che citano il nome precedente.

- [ ] **Step 8 (Minor 11): nota nel README di verifica** — in fondo alla sezione «Supabase reale» di `docs/verifiche/correzioni-tappa-2/README.md` aggiungi:
  ```markdown
  Se `poke_config` viene salvata in una forma non valida, `/admin/poke` mostra «Configurazione della poke non trovata» e la poke composta non è ordinabile: si corregge solo via SQL, ripristinando `gruppi` come array JSON di gruppi. La migrazione della tappa 1 è stata rinominata in `20261011163506_menu_e_ruoli.sql`, la versione registrata sul progetto Supabase.
  ```

- [ ] **Step 9:** `npm test` → **41 file, 192 test passati**; `npm run typecheck`; `npm run lint`; `npm run build`.
- [ ] **Step 10: commit** — `git add -A src supabase docs/verifiche/correzioni-tappa-2/README.md && git status --short` (controlla che compaiano solo i file di questo task) `&& git commit -m "Rifiniture: origine QR robusta, poke da ricomporre, saluto tavolo e nome migrazione"`

---

### Task 7: Prova nel browser, documentazione e consegna

- [ ] **Step 1: prova locale nel browser con il DB reale** — chiedi all'utente: «Per la prova nel browser devo aprire un tavolo, creare 2–3 ordini di prova e poi cancellarli dal DB reale con SQL che riporterò nel README. Posso procedere?» **Solo col suo sì**: `npm run build && npm run start`, l'utente fa il login admin/staff, poi verifica e annota l'esito di ciascun punto:
  1. `/staff`: «Inizia turno», apri Tavolo 1, da un'altra finestra in incognito entra col codice e invia un ordine → badge «Nuovo ordine» e suono.
  2. Vai su «Conto» del tavolo e torna a `/staff` → nessun «Riattiva suono»; invia un altro ordine mentre sei sul conto e torna → l'ordine è segnalato come nuovo.
  3. Sul conto: apri la pagina, invia un ordine dal cliente, aspetta più di 15 secondi → compare «È arrivato 1 nuovo ordine…»; «Chiudi tavolo» chiede conferma («ordini arrivati dopo il conto»); «Ho ricontrollato il conto» toglie l'avviso.
  4. Simula un DB non raggiungibile **senza toccare Supabase e senza modificare `.env.local`**: con `/staff` aperto e turno iniziato, ferma il server e riavvialo con una `DATABASE_URL` sbagliata solo per quel processo (le variabili del processo hanno la precedenza su `.env.local`). PowerShell: `$env:DATABASE_URL='postgres://x:x@127.0.0.1:1/x'; npm run start`. Bash: `DATABASE_URL=postgres://x:x@127.0.0.1:1/x npm run start`. Atteso: banner «Database non raggiungibile… mostra gli ultimi dati ricevuti», ordini e tavoli ancora visibili, nessun «Riattiva suono». Poi ferma il server, in PowerShell esegui `Remove-Item Env:DATABASE_URL`, riavvia normalmente → banner sparito e dati aggiornati **senza ricaricare la pagina**.
  5. Riapri un tavolo chiuso e ricarica la pagina cliente con il vecchio cookie → nessun «Il tavolo è chiuso».
  Poi chiudi il tavolo e pulisci i dati di prova con SQL (prima mostra all'utente le query, poi eseguile col suo sì) e riportale nel README.
- [ ] **Step 2: README di verifica** — in `docs/verifiche/correzioni-tappa-2/README.md` aggiungi in fondo una sezione `## Correzioni dopo la revisione della PR #3` con: elenco N1–N4 e Minor 2, 3, 5, 9, 10, 11, 12 chiusi (una riga ciascuno, con file), comandi eseguiti e risultati (numero di test), esito dei 5 punti della prova nel browser, SQL di pulizia eseguito con i conteggi.
- [ ] **Step 3: commit** — `git add docs/verifiche/correzioni-tappa-2/README.md && git commit -m "Verifica delle correzioni dopo la revisione della PR #3"`
- [ ] **Step 4: consegna** — `git push` (stesso branch, niente force). Aggiorna la descrizione della PR #3 con `gh pr edit 3 --repo carnedasosa/gestionale-daniel-sushi --body-file <file>` aggiungendo in fondo la sezione «Correzioni dopo la revisione» (stesso contenuto dello Step 2, in breve). **Non fare merge.** Riferisci all'utente: commit creati, test, punti della prova nel browser, eventuali scostamenti dal piano.

---

## Fuori da questo piano (non farli)

- TLS verso il pooler di Supabase (serve il certificato CA dal pannello Supabase: decide l'utente).
- Minor 4 (annullare una sola porzione dal conto), Minor 6 parte SQL (già fatta nella consegna precedente), Minor 7 (si risolve unendo la PR), Minor 1 e 8 (coperti dal Task 1).
- Qualsiasi modifica grafica o al design system.
