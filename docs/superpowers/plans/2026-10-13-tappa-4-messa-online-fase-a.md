# Tappa 4 — Messa online, fase A — Implementation Plan

> **Per chi esegue (Codex o altro agente):** esegui la **Parte 1** di questo piano task per task, **nell'ordine**, spuntando le checkbox `- [ ]`. La **Parte 2** (pubblicazione su Vercel e prova in sala) la esegue Claude con l'utente: tu **non** la tocchi.
>
> Il codice della Parte 1 **è già stato scritto e verificato** su un branch di prova partito da `c62ae5f`, cioè da questo stesso branch prima del piano. Verifiche fatte:
> - per ogni task: `tsc`, `eslint` e i test toccati dal task;
> - alla fine: suite completa 64 file / 292 test, `next build` senza `.env.local`;
> - `npm run e2e` (2 prove nel browser) passato 3 volte su 3;
> - connessione al DB reale con TLS verificato, in sola lettura.
>
> I blocchi «Crea», «Sostituisci tutto il contenuto», «Modifica… sostituisci… con…» e «Aggiungi in fondo» sono generati direttamente da quei commit. Il tuo compito è **riportarli fedelmente**, eseguire i test e fare i commit. Leggi prima la sezione «Regole di esecuzione»: valgono più di qualunque tua preferenza.

**Goal:** preparare l'app per stare online in sicurezza: connessione cifrata e verificata al database, funzioni Vercel a Francoforte, prove end-to-end nel browser dei percorsi tavolo e casa su un database finto.

**Architecture:**
- `src/server/tls-db.ts` decide il TLS dall'URL del database: spento solo in locale, altrimenti con la CA pubblica di Supabase (`src/server/ca-supabase.ts`) e `rejectUnauthorized: true`. Rifiuta i parametri `ssl*` nell'URL, che in `pg` annullerebbero la verifica. Lo usano `src/server/db.ts` e i due script con `pg`.
- `vercel.json` fissa la regione `fra1`.
- Le prove end-to-end (Playwright, solo Chromium) compilano l'app con `next build`, la avviano con `next start` su `127.0.0.1:3100` e la collegano a un PGlite in memoria con migrazioni, seed e dati di prova (`e2e/db-locale.ts`).
  - Il PGlite è esposto da un piccolo server (`e2e/server-pglite.ts`) che manda a PGlite blocchi interi di protocollo. `@electric-sql/pglite-socket` **non va usato**: alterna i singoli messaggi di connessioni diverse e, con lo schermo staff che fa più letture insieme, produce errori come `bind message supplies 3 parameters, but prepared statement "" requires 1`.
  - Il login dello staff usa Supabase Auth vero con un utente di prova (`E2E_EMAIL`, `E2E_PASSWORD` in `.env.local`), che ha il ruolo admin **solo** nel PGlite.

**Tech Stack:** Next.js 16.4, React 19.3, `pg` 8.23.0, Vitest 5 con PGlite 0.5.8, TypeScript. Una sola dipendenza nuova: `@playwright/test` **1.63.0** (devDependency, versione esatta).

**Spec:** `docs/superpowers/specs/2026-10-13-tappa-4-messa-online-design.md`, da leggere tutta prima di iniziare. Spec generale: `docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`.

---

## Regole di esecuzione (non negoziabili)

1. **Fai solo quello che c'è scritto.** Niente refactoring, rinomini, riformattazioni, aggiornamenti di dipendenze, cambi di stile o «migliorie» non richieste. Se un file non è nominato in un task, non lo tocchi.
2. **Il codice va copiato com'è**, compresi commenti, nomi e virgole senza spazio. Lo stile del repo è compatto (`a,b` invece di `a, b`): non «sistemarlo».
3. **Le modifiche sono «sostituisci questo blocco con quest'altro».**
   - Il blocco «prima» deve comparire **identico e una volta sola** nel file. Su Windows i file possono avere fine riga CRLF: la differenza CRLF/LF non conta, tutto il resto sì.
   - Se il blocco non si trova, o si trova più volte, **fermati** e scrivi all'utente file e blocco. Non adattare a intuito.
   - Più modifiche sullo stesso file («1 di 2», «2 di 2») vanno applicate nell'ordine scritto.
4. **«Sostituisci tutto il contenuto»** riscrive il file per intero con il blocco dato. **«Aggiungi in fondo»** aggiunge il blocco dopo l'ultima riga del file, su una riga nuova.
5. **Se un test non passa come previsto, fermati** e riporta l'output.
   - Non cambiare il test per farlo passare e non cambiare l'implementazione in modo diverso da quanto scritto.
   - Al massimo un tentativo di correggere un tuo errore di copia; poi fermati.
   - Un timeout isolato di PGlite con la macchina carica (`Test timed out` nel `beforeEach`) non è un errore del codice: rilancia una volta. Se si ripete, fermati.
6. **Database reale:** nessuna scrittura, migrazione o pulizia sul Supabase reale. Puoi fare solo le operazioni marcate **(sola lettura)**. Non stampare mai il contenuto di `.env.local`, la `DATABASE_URL` né `E2E_PASSWORD`.
7. **Non inserire mai password dell'utente** e non modificare `.env.local`. `E2E_EMAIL` ed `E2E_PASSWORD` li ha già messi l'utente; i test li leggono da soli.
8. **Branch:** lavori su `tappa-4-online`, che contiene già spec e piano, e alla fine apri la PR verso `main`. **Non fare merge**, non toccare `main`, non creare progetti o deploy su Vercel e non toccare le impostazioni di Supabase: è la Parte 2.
9. **Commit piccoli in italiano**, uno per task, con il messaggio indicato. Niente `--no-verify`, niente `git push --force`. Non aggiungere righe `Co-Authored-By` di Claude: usa l'attribuzione del tuo strumento o nessuna.
10. Questo è **Next.js 16**: se devi capire un'API, leggi `node_modules/next/dist/docs/` (vedi `AGENTS.md`), non la memoria.
11. **Server e porte:** non avviare `npm run dev` durante il piano. `npm run e2e` usa le porte **3100** (app) e **55432** (database finto) e le avvia da sé: devono essere libere. Su Windows `npm ci` fallisce con `EPERM` se resta acceso un `next start`/`next dev` del progetto.

## Global Constraints

- **Dipendenze:** l'unica nuova è `@playwright/test` `1.63.0` (devDependency, `--save-exact`). Le altre restano invariate (`next` 16.4.0, `react` 19.3.0, `pg` 8.23.0, `@electric-sql/pglite` 0.5.8, `vitest` 5.0.3). Niente `@electric-sql/pglite-socket`.
- **TLS:** verso qualsiasi host diverso da `localhost`, `127.0.0.1` e `[::1]` la connessione usa sempre `{ ca: CA_SUPABASE_2021, rejectUnauthorized: true }`. Nessun ripiego in chiaro. `DATABASE_URL` non deve contenere parametri `ssl*` né `uselibpqcompat`.
- **CA di Supabase:** «Supabase Root 2021 CA», SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, scade il 26/04/2031.
- **Regione Vercel:** `fra1` (il database Supabase è in `eu-central-1`). Cron invariato: `/api/cron/anonimizza`, `0 3 * * *`.
- **Prove end-to-end:** solo contro `postgresql://postgres@127.0.0.1:55432/postgres` (PGlite in memoria); mai il database reale. App su `http://127.0.0.1:3100`, build di produzione. Telefono = viewport 375×812.
- **Variabili nuove** (solo locale): `E2E_EMAIL`, `E2E_PASSWORD`; facoltativa `E2E_DEBUG=1` per il registro del database finto.

## Review Focus

Casi che i test automatici non coprono e che un revisore (o la Parte 2) deve guardare:

1. **Primo deploy su Vercel (Linux, fine riga LF) con il DB reale.** I test provano `opzioniTls` e la CA, ma la stretta di mano TLS vera con il pooler l'ha provata solo il comando in sola lettura del Task 1, da Windows. Nella Parte 2 i log delle funzioni non devono mostrare errori `self-signed certificate` o `Hostname/IP does not match`.
2. **`DATABASE_URL` incollata male su Vercel** (con `?sslmode=require`, tra virgolette, con spazi). Con `sslmode` l'app deve fallire con il messaggio esplicito (test in `db.test.ts`); con un URL non valido il messaggio non deve mostrare la password (test in `tls-db.test.ts`).
3. **Codice dell'app che dentro una transazione usa una seconda connessione del pool.** Su Postgres vero funziona, sul database finto delle prove si blocca: il server di `e2e/server-pglite.ts` dà PGlite alla sola connessione che ha la transazione aperta. Oggi non succede; se una prova futura resta appesa, `E2E_DEBUG=1 npm run e2e` mostra `transazione di #N: in attesa`.
4. **Prove lanciate vicino alla mezzanotte.** Dopo le 23:00 di Roma la prova da casa si salta con un messaggio esplicito; tra le 00:00 e le 23:00 le fasce partono dall'ora corrente (anticipo 0 nel database finto).
5. **Porte occupate o `.env.local` senza utente di prova.** Con 3100 o 55432 occupate Playwright si ferma subito; senza `E2E_EMAIL`/`E2E_PASSWORD` il database finto non parte e lo dice («Servono … in .env.local»).

## Stato verificato (13/10/2026)

- **Branch:** `tappa-4-online` = `main` (`6f82aec`) + spec della tappa 4 (`54dbe81`, `c62ae5f`) + questo piano.
- **Suite di partenza:** 62 file, 285 test. Dopo questo piano: 64 file, 292 test, più 2 prove end-to-end.
- **DB reale (sola lettura):** 5 migrazioni, 3 ordini da tavolo. Il pooler `aws-1-eu-central-1.pooler.supabase.com:6543` presenta `*.pooler.supabase.com`, firmato da «Supabase Intermediate 2021 CA» → «Supabase Root 2021 CA». Con la CA e `rejectUnauthorized: true` la connessione riesce; senza CA viene rifiutata (`self-signed certificate in certificate chain`).
- **Utente di prova:** creato dall'utente in Supabase Auth; `E2E_EMAIL` ed `E2E_PASSWORD` presenti in `.env.local`. Nessun ruolo sul DB reale.

## Mappa dei file

- **Nuovi:**
  - `src/server/ca-supabase.ts` (CA pubblica di Supabase), `src/server/tls-db.ts` (+ `tls-db.test.ts`);
  - `tests/vercel-config.test.ts`;
  - `playwright.config.ts`;
  - `e2e/dati.ts` (porte, URL, tavolo di prova), `e2e/server-pglite.ts` (server Postgres sopra PGlite), `e2e/db-locale.ts` (database finto con dati di prova), `e2e/aiuti.ts` (login staff, telefono, card), `e2e/tavolo.spec.ts`, `e2e/casa.spec.ts`.
- **Modificati:** `src/server/db.ts` (+ `db.test.ts`), `scripts/assegna-ruolo.ts`, `scripts/verifica-poke-postgres.ts`, `vercel.json`, `tests/db/pglite.ts` (esporta lo stub di Supabase), `package.json` e `package-lock.json` (Playwright e script `e2e`), `.gitignore`, `README.md`, `.env.example`.

---

# Parte 1 — Codice (la esegue Codex)

### Task 0: Preparazione

- [x] **Step 1:** `git status` deve essere pulito. Poi `git checkout tappa-4-online`. Se il branch è anche su GitHub, esegui `git pull`.
- [x] **Step 2:** `git log --oneline -4` deve mostrare in cima il commit del piano, poi `Spec tappa 4: team Vercel già su Pro` (`c62ae5f`), `Spec della tappa 4: messa online in due fasi` (`54dbe81`) e `6f82aec`. Se ci sono altri commit che toccano file di questo piano, **fermati** e chiedi.
- [x] **Step 3:** `npm ci` e poi `npm test` → atteso **62 file, 285 test passati**. Se no, fermati.
- [x] **Step 4 (sola lettura):** controlla che l'utente di prova sia configurato, senza stampare i valori:

```bash
grep -c "^E2E_EMAIL=.\+" .env.local
grep -c "^E2E_PASSWORD=.\+" .env.local
```

Atteso: `1` e `1`. Se no, **fermati** e chiedi all'utente di aggiungerli (vedi `.env.example` dopo il Task 5). Non scriverli tu.

---

### Task 1: Connessione cifrata al database

**File:**
- Crea: `src/server/ca-supabase.ts`, `src/server/tls-db.ts`, `src/server/tls-db.test.ts`
- Modifica: `src/server/db.ts`, `src/server/db.test.ts`, `scripts/assegna-ruolo.ts`, `scripts/verifica-poke-postgres.ts`

**Interfacce:**
- Produce: `opzioniTls(url: string): false | ConnectionOptions` (da `node:tls`) e `CA_SUPABASE_2021: string`.

- [x] **Step 1: test che falliscono.** **Crea** `src/server/tls-db.test.ts`:

```ts
import { X509Certificate } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CA_SUPABASE_2021 } from './ca-supabase'
import { opzioniTls } from './tls-db'

const POOLER = 'postgresql://postgres.abc:segreta@aws-1-eu-central-1.pooler.supabase.com:6543/postgres'
describe('opzioniTls', () => {
  it('in locale (PGlite e server finti) nessun TLS', () => {
    expect(opzioniTls('postgresql://postgres:postgres@127.0.0.1:5432/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@localhost:55432/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@LOCALHOST/postgres')).toBe(false)
    expect(opzioniTls('postgresql://postgres@[::1]:5432/postgres')).toBe(false)
  })
  it('ogni altro host: TLS con la CA di Supabase e certificato verificato', () => {
    expect(opzioniTls(POOLER)).toEqual({ ca: CA_SUPABASE_2021,rejectUnauthorized: true })
    expect(opzioniTls('postgresql://u:p@db.esempio.it/postgres')).toEqual({ ca: CA_SUPABASE_2021,rejectUnauthorized: true })
  })
  it('rifiuta i parametri TLS nell’URL, che in pg sostituirebbero la verifica', () => {
    for (const parametro of ['sslmode=require','sslmode=disable','ssl=true','sslrootcert=system','uselibpqcompat=true'])
      expect(() => opzioniTls(`${POOLER}?${parametro}`),parametro).toThrow(/DATABASE_URL/)
    expect(() => opzioniTls(`${POOLER}?application_name=gestionale`)).not.toThrow()
  })
  it('URL non valido: errore che non mostra la password', () => {
    expect(() => opzioniTls('non è un url segreta')).toThrow(/DATABASE_URL/)
    try { opzioniTls('non è un url segreta') } catch (e) { expect(String(e)).not.toContain('segreta') }
  })
})
describe('CA di Supabase', () => {
  it('è la «Supabase Root 2021 CA» attesa', () => {
    const ca = new X509Certificate(CA_SUPABASE_2021)
    expect(ca.subject).toContain('CN=Supabase Root 2021 CA')
    expect(ca.fingerprint256).toBe('80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA')
    expect(ca.ca).toBe(true)
  })
})
```

- [x] **Step 2:** `npx vitest run src/server/tls-db.test.ts` → atteso **FAIL**: `Failed to resolve import "./ca-supabase"` (o `./tls-db`).

- [x] **Step 3:** **Crea** `src/server/ca-supabase.ts` (il certificato va copiato carattere per carattere):

```ts
// Certificato pubblico «Supabase Root 2021 CA» (prod-ca-2021.crt, Supabase → Database → SSL Configuration).
// Firma il certificato del pooler (*.pooler.supabase.com). Scade il 26/04/2031.
// SHA-256: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
export const CA_SUPABASE_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`
```

- [x] **Step 4:** **Crea** `src/server/tls-db.ts`:

```ts
import type { ConnectionOptions } from 'node:tls'
import { CA_SUPABASE_2021 } from './ca-supabase'

const LOCALI = new Set(['localhost','127.0.0.1','[::1]'])
// In pg i parametri TLS dell'URL sostituiscono l'opzione ssl: la verifica del certificato sparirebbe.
const PARAMETRI_TLS = /^(ssl.*|uselibpqcompat)$/i

/** TLS verso il database: spento solo in locale, altrimenti con la CA di Supabase e il certificato verificato. */
export function opzioniTls(url: string): false | ConnectionOptions {
  let indirizzo: URL
  try { indirizzo = new URL(url) } catch { throw new Error('DATABASE_URL non è un indirizzo valido') }
  if ([...indirizzo.searchParams.keys()].some(k => PARAMETRI_TLS.test(k)))
    throw new Error('DATABASE_URL non deve contenere parametri ssl/sslmode: la cifratura la imposta il gestionale')
  if (LOCALI.has(indirizzo.hostname.toLowerCase())) return false
  return { ca: CA_SUPABASE_2021,rejectUnauthorized: true }
}
```

- [x] **Step 5:** `npx vitest run src/server/tls-db.test.ts` → atteso **5 test passati**. Se fallisce il test dell'impronta, il certificato è stato copiato male: ricopialo.

- [x] **Step 6: test del pool.** In `src/server/db.test.ts` (modifica 1 di 3) **sostituisci**:

```ts
import { afterEach, expect, it, vi } from 'vitest'
```

con:

```ts
import { afterEach, expect, it, vi } from 'vitest'
import { CA_SUPABASE_2021 } from './ca-supabase'
```

(modifica 2 di 3) **sostituisci**:

```ts
  expect(m.Pool).toHaveBeenCalledWith({ connectionString: 'postgres://prova', max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
```

con:

```ts
  expect(m.Pool).toHaveBeenCalledWith({ connectionString: 'postgres://prova', max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
    ssl: { ca: CA_SUPABASE_2021, rejectUnauthorized: true } })
```

(modifica 3 di 3) **aggiungi in fondo** al file:

```ts
it('in locale il pool non usa TLS; un URL con sslmode non crea il pool', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://postgres@127.0.0.1:55432/postgres')
  m.Pool.mockImplementation(function () { return { query: m.query, on: m.on } })
  m.query.mockResolvedValueOnce({ rows: [] })
  const { db } = await import('./db')
  await db.query('select 1')
  expect(m.Pool).toHaveBeenCalledWith(expect.objectContaining({ ssl: false }))
  vi.resetModules(); m.Pool.mockClear()
  vi.stubEnv('DATABASE_URL', 'postgres://u:p@pooler.esempio.it/postgres?sslmode=require')
  const { db: db2 } = await import('./db')
  await expect(db2.query('select 1')).rejects.toThrow('sslmode')
  expect(m.Pool).not.toHaveBeenCalled()
})
```

- [x] **Step 7:** `npx vitest run src/server/db.test.ts` → atteso **FAIL** su 2 test (il pool non riceve ancora `ssl`), 1 passato.

- [x] **Step 8:** In `src/server/db.ts` (modifica 1 di 2) **sostituisci**:

```ts
import { adattaPool, OPZIONI_POOL } from './db-adapter'
```

con:

```ts
import { adattaPool, OPZIONI_POOL } from './db-adapter'
import { opzioniTls } from './tls-db'
```

(modifica 2 di 2) **sostituisci**:

```ts
    pool = new pg.Pool({ connectionString: url, ...OPZIONI_POOL })
```

con:

```ts
    pool = new pg.Pool({ connectionString: url, ...OPZIONI_POOL, ssl: opzioniTls(url) })
```

- [x] **Step 9:** In `scripts/assegna-ruolo.ts` (modifica 1 di 2) **sostituisci**:

```ts
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
```

con:

```ts
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
import { opzioniTls } from '../src/server/tls-db'
```

(modifica 2 di 2) **sostituisci**:

```ts
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ...OPZIONI_POOL, max: 1 })
```

con:

```ts
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ...OPZIONI_POOL, max: 1, ssl: opzioniTls(process.env.DATABASE_URL) })
```

- [x] **Step 10:** In `scripts/verifica-poke-postgres.ts` (modifica 1 di 2) **sostituisci**:

```ts
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
```

con:

```ts
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
import { opzioniTls } from '../src/server/tls-db'
```

(modifica 2 di 2) **sostituisci**:

```ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL!, ...OPZIONI_POOL, max: 1 })
```

con:

```ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL!, ...OPZIONI_POOL, max: 1, ssl: opzioniTls(process.env.DATABASE_URL!) })
```

- [x] **Step 11:** `npx vitest run src/server` → atteso **3 file, 13 test passati**. Poi `npm run typecheck` e `npm run lint` senza errori.

- [x] **Step 12 (sola lettura sul DB reale):** prova la connessione cifrata. Legge solo un conteggio, non stampa la `DATABASE_URL`:

```bash
npx tsx --env-file=.env.local --eval "import pg from 'pg'; import { opzioniTls } from './src/server/tls-db'; const url = process.env.DATABASE_URL!; const c = new pg.Client({ connectionString: url, ssl: opzioniTls(url) }); c.connect().then(async () => { console.log('TLS verificato:', (c as any).connection.stream.authorized, '| ordini:', (await c.query('select count(*)::int as n from ordini')).rows[0].n); await c.end() }).catch(e => { console.error('ERRORE', e.message); process.exit(1) })"
```

Atteso: `TLS verificato: true | ordini: 3` (il numero può essere diverso se nel frattempo il locale ha usato l'app). Se compare `ERRORE`, **fermati** e riporta il messaggio.

- [x] **Step 13: commit.**

```bash
git add src/server/ca-supabase.ts src/server/tls-db.ts src/server/tls-db.test.ts src/server/db.ts src/server/db.test.ts scripts/assegna-ruolo.ts scripts/verifica-poke-postgres.ts
git commit -m "Connessione al database cifrata con la CA di Supabase e certificato verificato"
```

---

### Task 2: Funzioni Vercel a Francoforte

**File:**
- Crea: `tests/vercel-config.test.ts`
- Modifica: `vercel.json`

- [x] **Step 1:** **Crea** `tests/vercel-config.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// Le funzioni girano a Francoforte, accanto al database Supabase (eu-central-1); senza regione Vercel usa iad1.
it('vercel.json: regione fra1 e cron di anonimizzazione', () => {
  const config = JSON.parse(readFileSync('vercel.json','utf8'))
  expect(config.regions).toEqual(['fra1'])
  expect(config.crons).toEqual([{ path: '/api/cron/anonimizza',schedule: '0 3 * * *' }])
})
```

- [x] **Step 2:** `npx vitest run tests/vercel-config.test.ts` → atteso **FAIL**: `expected undefined to deeply equal [ 'fra1' ]`.

- [x] **Step 3:** **Sostituisci tutto il contenuto** di `vercel.json` con:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/cron/anonimizza", "schedule": "0 3 * * *" }]
}
```

- [x] **Step 4:** `npx vitest run tests/vercel-config.test.ts` → atteso **1 test passato**.

- [x] **Step 5: commit.**

```bash
git add vercel.json tests/vercel-config.test.ts
git commit -m "Vercel: funzioni a Francoforte, accanto al database"
```

---

### Task 3: Prove end-to-end — database finto, Playwright e percorso del tavolo

**File:**
- Crea: `playwright.config.ts`, `e2e/dati.ts`, `e2e/server-pglite.ts`, `e2e/db-locale.ts`, `e2e/aiuti.ts`, `e2e/tavolo.spec.ts`
- Modifica: `package.json`, `package-lock.json` (con `npm install`), `.gitignore`, `tests/db/pglite.ts`

**Interfacce:**
- Consuma: `STUB_SUPABASE` da `tests/db/pglite.ts` (diventa esportato in questo task).
- Produce: `PORTA_DB`, `PORTA_APP`, `URL_DB`, `TAVOLO_E2E` (`e2e/dati.ts`); `avviaServerPglite(db, porta)` (`e2e/server-pglite.ts`); `apriSchermoStaff(browser)`, `apriTelefono(browser)`, `cardOrdine(staff, titolo)`, `oraDiRoma()`, `sposta(ora, minuti)` (`e2e/aiuti.ts`), usati anche dal Task 4.

- [x] **Step 1: dipendenza.** Esattamente:

```bash
npm install --save-dev --save-exact --no-audit --no-fund @playwright/test@1.63.0
```

In `package.json` deve comparire `"@playwright/test": "1.63.0"` tra le `devDependencies` (senza `^`). Nessun'altra dipendenza deve cambiare: controlla con `git diff package.json`.

- [x] **Step 2: browser.** `npx playwright install chromium` (scarica Chromium per Playwright, circa 115 MB, nella cartella utente `ms-playwright`).

- [x] **Step 3:** In `package.json` **sostituisci**:

```json
    "test:watch": "vitest",
```

con:

```json
    "test:watch": "vitest",
    "e2e": "playwright test",
```

- [x] **Step 4:** In `.gitignore` **sostituisci**:

```
# testing
/coverage
```

con:

```
# testing
/coverage
/playwright-report
/test-results
```

- [x] **Step 5:** In `tests/db/pglite.ts` **sostituisci**:

```ts
const STUB_SUPABASE = `
```

con:

```ts
export const STUB_SUPABASE = `
```

- [x] **Step 6:** **Crea** `e2e/dati.ts`:

```ts
// Valori condivisi fra il database di prova, la configurazione di Playwright e i test.
export const PORTA_DB = 55432
export const PORTA_APP = 3100
export const URL_DB = `postgresql://postgres@127.0.0.1:${PORTA_DB}/postgres`
export const TAVOLO_E2E = { nome: 'Tavolo prova',slug: 'tavolo-prova',chiave: 'provae2e0001' }
```

- [x] **Step 7:** **Crea** `e2e/server-pglite.ts`:

```ts
import { createServer, type Server, type Socket } from 'node:net'
import type { PGlite } from '@electric-sql/pglite'

// PGlite ha una sola connessione. Questo server la divide fra più client Postgres (il pool dell'app)
// mandando a PGlite blocchi interi di protocollo: dal primo messaggio fino a Sync o Query.
// Così i Parse/Bind/Execute di due connessioni non si mescolano, e una transazione aperta
// tiene PGlite per la sua connessione finché non si chiude.
const SSL_REQUEST = 80877103, CANCEL_REQUEST = 80877102, PROTOCOLLO_3 = 196608
const FINE_BLOCCO = new Set(['S','Q']) // Sync, Query semplice

interface Blocco { connessione: number; dati: Uint8Array; scrivi: (risposta: Uint8Array) => void; fatto: () => void }

export function avviaServerPglite(db: PGlite, porta: number): Promise<Server> {
  const coda: Blocco[] = []
  let inCorso = false, ultima: number | null = null, prossimoId = 1
  async function elabora() {
    if (inCorso) return
    inCorso = true
    try {
      while (coda.length) {
        // Durante una transazione passano solo i blocchi della connessione che l'ha aperta.
        const i = db.isInTransaction() && ultima !== null ? coda.findIndex(b => b.connessione === ultima) : 0
        if (i === -1) { if (process.env.E2E_DEBUG) console.log(`[db] transazione di #${ultima}: in attesa, coda ${coda.map(c => c.connessione).join(',')}`); break }
        const [b] = coda.splice(i,1)
        if (process.env.E2E_DEBUG) console.log(`[db] #${b.connessione} ${Buffer.from(b.dati).toString('latin1').replace(/[^ -~]+/g,' ').slice(0,140)}`)
        try { await db.runExclusive(() => db.execProtocolRawStream(b.dati,{ onRawData: b.scrivi })) }
        finally { ultima = b.connessione; b.fatto() }
      }
    } finally { inCorso = false }
  }
  const accoda = (connessione: number, dati: Uint8Array, scrivi: (r: Uint8Array) => void) =>
    new Promise<void>(fatto => { coda.push({ connessione,dati,scrivi,fatto }); void elabora() })

  const server = createServer((socket: Socket) => {
    const id = prossimoId++
    let buffer = Buffer.alloc(0), avviata = false, catena = Promise.resolve()
    const scrivi = (r: Uint8Array) => { if (r.length && socket.writable) socket.write(r) }
    socket.setNoDelay(true)
    socket.on('data',parte => {
      buffer = Buffer.concat([buffer,parte])
      const blocchi: Buffer[] = []
      let inizio = 0, pos = 0
      while (true) {
        if (!avviata) {
          // Messaggi iniziali senza tipo: richiesta SSL (si risponde «N»), annullamento, avvio.
          if (buffer.length - pos < 8) break
          const lunghezza = buffer.readInt32BE(pos), codice = buffer.readInt32BE(pos + 4)
          if (buffer.length - pos < lunghezza) break
          if (codice === SSL_REQUEST) socket.write('N')
          else if (codice === CANCEL_REQUEST) { /* non supportato: si ignora */ }
          else if (codice === PROTOCOLLO_3) { blocchi.push(buffer.subarray(pos,pos + lunghezza)); avviata = true }
          pos += lunghezza; inizio = pos
          continue
        }
        if (buffer.length - pos < 5) break
        const tipo = String.fromCharCode(buffer[pos]), lunghezza = 1 + buffer.readInt32BE(pos + 1)
        if (buffer.length - pos < lunghezza) break
        pos += lunghezza
        // Terminate chiude solo questa connessione: a PGlite non va mandato.
        if (tipo === 'X') { if (pos - lunghezza > inizio) blocchi.push(buffer.subarray(inizio,pos - lunghezza)); inizio = pos }
        else if (FINE_BLOCCO.has(tipo)) { blocchi.push(buffer.subarray(inizio,pos)); inizio = pos }
      }
      buffer = buffer.subarray(inizio)
      for (const blocco of blocchi) catena = catena.then(() => accoda(id,new Uint8Array(blocco),scrivi))
    })
    socket.on('error',() => socket.destroy())
    socket.on('close',() => {
      catena = catena.then(async () => {
        // Una connessione chiusa a metà transazione non deve lasciare PGlite bloccato.
        if (db.isInTransaction() && ultima === id) { await db.exec('rollback'); ultima = null }
        void elabora()
      })
    })
  })
  return new Promise((risolvi,rifiuta) => { server.once('error',rifiuta); server.listen(porta,'127.0.0.1',() => risolvi(server)) })
}
```

- [x] **Step 8:** **Crea** `e2e/db-locale.ts`:

```ts
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
```

- [x] **Step 9:** **Crea** `e2e/aiuti.ts`:

```ts
import { expect, type Browser, type Page } from '@playwright/test'

/** Login dell'utente di prova (E2E_EMAIL/E2E_PASSWORD in .env.local) e schermo staff con il turno iniziato. */
export async function apriSchermoStaff(browser: Browser): Promise<Page> {
  const { E2E_EMAIL: email,E2E_PASSWORD: password } = process.env
  if (!email || !password) throw new Error('Servono E2E_EMAIL ed E2E_PASSWORD in .env.local')
  const page = await (await browser.newContext({ viewport: { width: 1280,height: 900 } })).newPage()
  await page.goto('/accesso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{ name: 'Entra' }).click()
  await page.waitForURL('**/admin')
  await page.goto('/staff')
  await page.getByRole('button',{ name: 'Inizia turno' }).click()
  await expect(page.getByRole('heading',{ name: 'Cucina' })).toBeVisible()
  return page
}

/** Telefono del cliente: viewport da 375×812 con touch. */
export async function apriTelefono(browser: Browser): Promise<Page> {
  return (await browser.newContext({ viewport: { width: 375,height: 812 },hasTouch: true,isMobile: true })).newPage()
}

/** Card di un ordine nello schermo staff, trovata dal titolo (es. «Tavolo prova · n. 4»). */
export function cardOrdine(staff: Page, titolo: string | RegExp) {
  return staff.locator('article').filter({ has: staff.getByRole('heading',{ name: titolo }) })
}

/** Ora di Roma (0–23), per saltare le prove da casa vicino alla mezzanotte. */
export function oraDiRoma(): number {
  return Number(new Intl.DateTimeFormat('it-IT',{ hour: '2-digit',hourCycle: 'h23',timeZone: 'Europe/Rome' }).format(new Date()))
}

/** «HH:MM» spostato di `minuti` (le fasce non attraversano la mezzanotte). */
export function sposta(ora: string, minuti: number): string {
  const [h,m] = ora.split(':').map(Number)
  const totale = h * 60 + m + minuti
  return `${String(Math.floor(totale / 60)).padStart(2,'0')}:${String(totale % 60).padStart(2,'0')}`
}
```

- [x] **Step 10:** **Crea** `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { PORTA_APP, PORTA_DB, URL_DB } from './e2e/dati'

// E2E_EMAIL ed E2E_PASSWORD dell'utente di prova servono ai test (login dello staff).
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

// Prove end-to-end sulla build di produzione, con il database finto di e2e/db-locale.ts.
// DATABASE_URL punta sempre a 127.0.0.1: le variabili del processo prevalgono su .env.local.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORTA_APP}`,locale: 'it-IT',timezoneId: 'Europe/Rome',trace: 'retain-on-failure' },
  projects: [{ name: 'chromium',use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npx tsx --env-file=.env.local e2e/db-locale.ts',port: PORTA_DB,timeout: 120_000,reuseExistingServer: false,stdout: 'pipe' },
    { command: `npx next build && npx next start -H 127.0.0.1 -p ${PORTA_APP}`,url: `http://127.0.0.1:${PORTA_APP}/accesso`,timeout: 600_000,reuseExistingServer: false,
      env: { DATABASE_URL: URL_DB,APP_URL: `http://127.0.0.1:${PORTA_APP}` },stdout: 'pipe' },
  ],
})
```

- [x] **Step 11:** **Crea** `e2e/tavolo.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { apriSchermoStaff, apriTelefono, cardOrdine } from './aiuti'
import { TAVOLO_E2E } from './dati'

test('tavolo: QR, codice, ordini da due telefoni, cucina e chiusura del conto', async ({ browser }) => {
  const staff = await apriSchermoStaff(browser)
  const tavolo = staff.locator('article').filter({ has: staff.getByRole('heading',{ name: TAVOLO_E2E.nome,exact: true }) })
  await tavolo.getByRole('button',{ name: 'Apri tavolo' }).click()
  const codice = (await tavolo.getByLabel(/^Codice \d{4}$/).textContent())!.trim()
  expect(codice).toMatch(/^\d{4}$/)

  // Due telefoni entrano dal link del QR con il codice del cameriere.
  const [anna,bruno] = [await apriTelefono(browser),await apriTelefono(browser)]
  for (const telefono of [anna,bruno]) {
    await telefono.goto(`/tavolo/${TAVOLO_E2E.chiave}`)
    await telefono.getByLabel('Codice del tavolo').fill(codice)
    await telefono.getByRole('button',{ name: 'Entra al tavolo' }).click()
    await expect(telefono.getByRole('button',{ name: /^Carrello · / })).toBeVisible()
  }

  // Anna: una tartare di salmone (6,00 €).
  await anna.locator('#tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await anna.getByRole('button',{ name: /^Carrello · 1 piatti/ }).click()
  await anna.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoAnna = anna.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoAnna).toBeVisible()
  const numeroAnna = (await inviatoAnna.textContent())!.match(/n\. (\d+)/)![1]

  // Bruno: una poke composta (base + una proteina, 9,00 €).
  await bruno.getByRole('button',{ name: 'Componi la tua poke' }).click()
  const poke = bruno.getByRole('dialog',{ name: 'Componi poke' })
  await poke.getByLabel('Riso bianco').check()
  await poke.getByLabel('Salmone crudo').check()
  await poke.getByRole('button',{ name: 'Aggiungi al carrello' }).click()
  await bruno.getByRole('button',{ name: /^Carrello · 1 piatti/ }).click()
  await bruno.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoBruno = bruno.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoBruno).toBeVisible()
  const numeroBruno = (await inviatoBruno.textContent())!.match(/n\. (\d+)/)![1]

  // Lo staff vede i due ordini (aggiornamento ogni 5 s) e li porta a «servito».
  for (const numero of [numeroAnna,numeroBruno]) {
    const card = cardOrdine(staff,`${TAVOLO_E2E.nome} · n. ${numero}`)
    await card.getByRole('button',{ name: 'In preparazione' }).click()
    await card.getByRole('button',{ name: 'Servito' }).click()
    await expect(card).toHaveCount(0)
  }
  await expect(tavolo).toContainText('2 ordini · 15,00 €')

  // Chiusura del tavolo: si passa al conto.
  await tavolo.getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.getByRole('dialog',{ name: 'Conferma' }).getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.waitForURL('**/staff/conto/**')
  await expect(staff.getByText('15,00 €').first()).toBeVisible()

  // Un nuovo telefono con il vecchio codice resta fuori.
  const carlo = await apriTelefono(browser)
  await carlo.goto(`/tavolo/${TAVOLO_E2E.chiave}`)
  await carlo.getByLabel('Codice del tavolo').fill(codice)
  await carlo.getByRole('button',{ name: 'Entra al tavolo' }).click()
  await expect(carlo.getByRole('alert').filter({ hasText: 'Il tavolo non è ancora aperto' })).toBeVisible()
  await expect(carlo.getByRole('button',{ name: /^Carrello · / })).toHaveCount(0)
})
```

- [x] **Step 12:** `npm run typecheck`, `npm run lint` e `npm test` → senza errori; atteso **64 file, 292 test passati** (Vitest non esegue i file `e2e/`).

- [x] **Step 13: prova nel browser.** Porte 3100 e 55432 libere, nessun `next dev` acceso. Poi:

```bash
npm run e2e
```

Prima compare `Database di prova pronto su 127.0.0.1:55432`, poi la build (1–2 minuti), poi atteso:

```
  ok 1 [chromium] › e2e\tavolo.spec.ts:5:5 › tavolo: QR, codice, ordini da due telefoni, cucina e chiusura del conto
  1 passed
```

Se fallisce, **fermati** e riporta l'output e il file `test-results/**/error-context.md`. Con `E2E_DEBUG=1 npm run e2e` il database finto stampa le interrogazioni: allega le ultime 30 righe che iniziano con `[db]`.

- [x] **Step 14: commit.** `git status` non deve mostrare `test-results/` né `playwright-report/`.

```bash
git add package.json package-lock.json .gitignore tests/db/pglite.ts playwright.config.ts e2e/dati.ts e2e/server-pglite.ts e2e/db-locale.ts e2e/aiuti.ts e2e/tavolo.spec.ts
git commit -m "Prove end-to-end: database finto, Playwright e percorso del tavolo"
```

---

### Task 4: Prova end-to-end dell'ordine da casa

**File:**
- Crea: `e2e/casa.spec.ts`

**Interfacce:**
- Consuma: `apriSchermoStaff`, `apriTelefono`, `cardOrdine`, `oraDiRoma`, `sposta` da `e2e/aiuti.ts` (Task 3).

- [x] **Step 1:** **Crea** `e2e/casa.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { apriSchermoStaff, apriTelefono, cardOrdine, oraDiRoma, sposta } from './aiuti'

test('da casa: ordine a domicilio, accettato +15’, seguito dal cliente fino alla consegna', async ({ browser }) => {
  test.skip(oraDiRoma() >= 23,'Dopo le 23:00 di Roma non restano fasce di oggi: le fasce non attraversano la mezzanotte.')
  const staff = await apriSchermoStaff(browser)
  await staff.getByRole('button',{ name: 'Apri ordini di oggi' }).click()
  await expect(staff.getByRole('heading',{ name: 'Ordini online: aperti oggi' })).toBeVisible()

  // Il cliente sceglie dal menù: 3 tartare di salmone (18,00 €), sopra il minimo di 15,00 € della zona.
  const cliente = await apriTelefono(browser)
  await cliente.goto('/')
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await cliente.getByRole('button',{ name: /^Carrello · 3 piatti/ }).click()
  await cliente.getByRole('button',{ name: 'Vai al riepilogo' }).click()
  await cliente.waitForURL('**/ordina')

  await cliente.getByLabel('Consegna a domicilio').check()
  await cliente.getByLabel('Zona').selectOption({ label: 'Centro · consegna 2,00 € · minimo 15,00 €' })
  await cliente.getByLabel('Indirizzo e numero civico').fill('Via Roma 1')
  const fascia = cliente.getByLabel('Consegna verso le')
  const prima = (await fascia.locator('option').nth(1).textContent())!.trim()
  await fascia.selectOption({ label: prima })
  await cliente.getByLabel('Nome').fill('Anna Prova')
  await cliente.getByLabel('Telefono').fill('3331234567')
  await cliente.getByLabel('Email (per la conferma)').fill('anna@esempio.it')
  await cliente.getByLabel('Carta (POS)').check()
  await cliente.getByLabel(/informativa privacy/).check()
  await cliente.getByRole('button',{ name: 'Conferma l’ordine · 20,00 €' }).click()
  await cliente.waitForURL('**/ordine/**')
  await expect(cliente.getByRole('status').filter({ hasText: 'In attesa di conferma' })).toBeVisible()
  const numero = (await cliente.getByRole('heading',{ level: 1 }).textContent())!.match(/n\. (\d+)/)![1]

  // Lo staff accetta con 15 minuti in più.
  const daAccettare = cardOrdine(staff,`Domicilio ${prima} · n. ${numero}`)
  await daAccettare.getByRole('button',{ name: 'Accetta +15’' }).click()
  const spostato = sposta(prima,15)
  const card = cardOrdine(staff,`Domicilio ${spostato} · n. ${numero}`)
  await expect(card).toBeVisible()

  // La pagina del cliente si aggiorna da sola (ogni 10 s) con lo stato e l'orario nuovo.
  await expect(cliente.getByRole('status').filter({ hasText: 'Confermato' })).toBeVisible({ timeout: 15_000 })
  await expect(cliente.getByText(spostato).first()).toBeVisible()

  for (const passo of ['In preparazione','Pronto','Partito','Consegnato']) await card.getByRole('button',{ name: passo }).click()
  await expect(card).toHaveCount(0)
  await cliente.reload()
  await expect(cliente.getByRole('status').filter({ hasText: 'Consegnato' })).toBeVisible()
})
```

- [x] **Step 2:** `npm run typecheck` e `npm run lint` senza errori.

- [x] **Step 3:** `npm run e2e` → atteso:

```
  ok 1 [chromium] › e2e\casa.spec.ts:4:5 › da casa: ordine a domicilio, accettato +15’, seguito dal cliente fino alla consegna
  ok 2 [chromium] › e2e\tavolo.spec.ts:5:5 › tavolo: QR, codice, ordini da due telefoni, cucina e chiusura del conto
  2 passed
```

Dopo le 23:00 di Roma la prova da casa risulta **skipped** con il motivo «Dopo le 23:00…»: in quel caso rilancia il comando dopo mezzanotte prima di andare avanti. Se fallisce, **fermati** come nel Task 3, Step 13.

- [x] **Step 4: commit.**

```bash
git add e2e/casa.spec.ts
git commit -m "Prova end-to-end dell'ordine da casa"
```

---

### Task 5: Documentazione, verifica finale e PR

**File:**
- Modifica: `README.md`, `.env.example`
- Crea: `docs/verifiche/2026-10-13-tappa-4-fase-a.md` (usa la data del giorno in cui esegui, nel nome e nel testo)

- [x] **Step 1:** In `README.md` (modifica 1 di 5) **sostituisci**:

```md
- **Tappa 3**: asporto e domicilio: zone, orari, fasce, checkout, accettazione con suono, pagina dello stato ed email.
```

con:

```md
- **Tappa 3**: asporto e domicilio: zone, orari, fasce, checkout, accettazione con suono, pagina dello stato ed email.
- **Tappa 4**: messa online: connessione cifrata al database, Vercel a Francoforte, prove end-to-end, poi dominio ed email.
```

(modifica 2 di 5) **sostituisci**:

```md
- Specifica della tappa 3: [`docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md`](docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md)
```

con:

```md
- Specifica della tappa 3: [`docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md`](docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md)
- Specifica della tappa 4: [`docs/superpowers/specs/2026-10-13-tappa-4-messa-online-design.md`](docs/superpowers/specs/2026-10-13-tappa-4-messa-online-design.md)
```

(modifica 3 di 5) **sostituisci**:

```md
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database |
```

con:

```md
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database. Senza `?sslmode=…`: la connessione è cifrata dal gestionale, con il certificato di Supabase (`src/server/ca-supabase.ts`) verificato |
```

(modifica 4 di 5) **sostituisci**:

```md
   | `ORDINI_CASA_PROVA` (solo locale) | `1` per provare gli ordini da casa senza allergeni confermati; ignorata in produzione |
```

con:

```md
   | `ORDINI_CASA_PROVA` (solo locale) | `1` per provare gli ordini da casa senza allergeni confermati; ignorata in produzione |
   | `E2E_EMAIL`, `E2E_PASSWORD` (solo locale) | utente di prova creato in Supabase → Authentication → Users, solo per `npm run e2e`; sul database reale non ha ruoli |
```

(modifica 5 di 5) **sostituisci**:

```md
| `npm run build` | compila l'app per la produzione |
```

con:

```md
| `npm run build` | compila l'app per la produzione |
| `npm run e2e` | prove end-to-end nel browser (tavolo e ordine da casa) sulla build di produzione, con un database finto |

## Prove end-to-end

`npm run e2e` compila l'app, la avvia su http://127.0.0.1:3100 e la collega a un database PGlite in memoria (`e2e/db-locale.ts`) con migrazioni, seed e dati di prova: il database reale non viene mai toccato. Il login dello staff usa Supabase Auth con l'utente di prova (`E2E_EMAIL`, `E2E_PASSWORD`), che riceve il ruolo admin solo nel database finto. La prima volta serve `npx playwright install chromium`. Dopo le 23:00 la prova da casa si salta, perché le fasce non attraversano la mezzanotte. Con `E2E_DEBUG=1` il database finto stampa le interrogazioni che riceve.

## Pubblicazione

L'app gira su Vercel, con le funzioni a Francoforte (`regions` in `vercel.json`) accanto al database Supabase (`eu-central-1`). Le variabili di Production si impostano nel progetto Vercel: quelle segrete (`DATABASE_URL`, `CRON_SECRET`) come «Sensitive». Le Preview non ricevono `DATABASE_URL`, così nessuna anteprima scrive sul database reale; `ORDINI_CASA_PROVA` non va mai impostata su Vercel.
```

- [x] **Step 2:** In `.env.example` (modifica 1 di 2) **sostituisci**:

```
# Supabase → Connect → Transaction pooler (porta 6543)
DATABASE_URL=
```

con:

```
# Supabase → Connect → Transaction pooler (porta 6543). Senza ?sslmode: la cifratura la imposta il gestionale.
DATABASE_URL=
```

(modifica 2 di 2) **sostituisci**:

```
# Solo in locale: 1 permette di provare gli ordini da casa senza allergeni confermati. Ignorata in produzione.
ORDINI_CASA_PROVA=
```

con:

```
# Solo in locale: 1 permette di provare gli ordini da casa senza allergeni confermati. Ignorata in produzione.
ORDINI_CASA_PROVA=
# Solo in locale, per npm run e2e: utente di prova creato in Supabase → Authentication → Users (nessun ruolo sul DB reale).
E2E_EMAIL=
E2E_PASSWORD=
```

- [x] **Step 3: verifica finale.**
  - `npm test` → atteso **64 file, 292 test passati**.
  - `npm run typecheck` e `npm run lint` senza errori.
  - Build come su Vercel, senza `.env.local`: rinomina temporaneamente `.env.local` in `.env.local.bak`, esegui `npm run build` (deve riuscire e mostrare `ƒ /api/cron/anonimizza`), poi **rimetti subito** il nome `.env.local`. Controlla con `git status` che `.env.local` non compaia.
  - `npm run e2e` → **2 passed** (o 1 passed + 1 skipped dopo le 23:00, come nel Task 4).

- [x] **Step 4: verbale.** **Crea** `docs/verifiche/2026-10-13-tappa-4-fase-a.md` con:
  - titolo `# Verifica della tappa 4 — fase A`, data e branch;
  - una tabella «Task | Verifica» con l'esito di ogni task (test prima e dopo il codice, numeri di file/test, esito di `npm run e2e`, esito dello Step 12 del Task 1 **senza** URL né password);
  - una sezione «Scostamenti» con tutto ciò che non è andato esattamente come scritto (anche «nessuno»);
  - una sezione vuota `## Parte 2 — pubblicazione e prova in sala`, che compilerà Claude.

- [x] **Step 5: commit.**

```bash
git add README.md .env.example docs/verifiche/2026-10-13-tappa-4-fase-a.md
git commit -m "Documentazione: prove end-to-end e pubblicazione su Vercel"
```

- [x] **Step 6: PR, senza merge.**

```bash
git push -u origin tappa-4-online
gh pr create --base main --head tappa-4-online --title "Tappa 4, fase A: connessione cifrata, Vercel a Francoforte e prove end-to-end" --body-file docs/verifiche/2026-10-13-tappa-4-fase-a.md
```

Poi spunta le caselle di questo piano che hai completato, fai un commit `Piano della tappa 4: caselle spuntate` e un `git push`. **Non fare merge**: avvisa l'utente che la Parte 1 è finita e passa la mano a Claude.

---

# Parte 2 — Pubblicazione e prova in sala (la esegue Claude con l'utente, non Codex)

Parte solo dopo il merge della PR della Parte 1 su `main`. Ogni passo con effetti esterni si fa dopo il «sì» dell'utente in chat.

### Task 6: Progetto Vercel e primo deploy

- [x] **Step 1 (Claude, dopo conferma):** crea nel team `carnedasosas-projects` il progetto Vercel collegato al repo `carnedasosa/gestionale-daniel-sushi`, framework Next.js, branch di produzione `main`.
- [x] **Step 2 (Claude):** variabili **solo Production**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (dal progetto Supabase, chiave pubblica), `APP_URL` = `https://<progetto>.vercel.app` (dominio di produzione assegnato da Vercel). Nessuna variabile in Preview e Development.
- [x] **Step 3 (utente):** nel progetto Vercel → Settings → Environment Variables, solo Production, «Sensitive» attivo:
  - `DATABASE_URL`: la stessa riga di `.env.local`, senza `?sslmode`;
  - `CRON_SECRET`: generato con `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
  `RESEND_API_KEY`, `EMAIL_MITTENTE` e `ORDINI_CASA_PROVA` **non** si impostano.
- [x] **Step 4 (Claude):** deploy di produzione da `main`. Leggi i log di build: build riuscita, nessun errore.

### Task 7: Controlli dopo il deploy

- [x] `/` risponde e il menù è leggibile su telefono (375 px).
- [x] Con il DB reale gli ordini da casa risultano **chiusi** (allergeni non confermati): è il comportamento voluto.
- [x] Login admin e staff sull'indirizzo `vercel.app`: le password le inserisce l'utente.
- [x] Log delle funzioni: regione `fra1`, nessun errore TLS (`self-signed certificate`, `Hostname/IP does not match`) né `sslmode`.
- [x] `GET /api/cron/anonimizza` senza segreto → **401**.
- [ ] Il giorno dopo: nei log c'è l'esecuzione del cron delle 03:00 UTC (05:00 di Roma con l'ora legale, 04:00 dal 25/10/2026).
- [x] Esiti nella sezione «Parte 2» del verbale `docs/verifiche/2026-10-13-tappa-4-fase-a.md`.

### Task 8: Prova in sala (locale chiuso)

Lista da compilare con l'utente e Daniel o lo staff, esiti nel verbale:

- [ ] QR provvisori dei tavoli stampati da `/admin/tavoli/stampa` su carta normale.
- [ ] Due o tre telefoni diversi (almeno un iPhone e un Android), sia con il Wi‑Fi del locale sia con la rete mobile: QR → codice → ordine, con una poke composta.
- [ ] Tablet dello staff: «Inizia turno», suono all'arrivo degli ordini, passaggi «In preparazione» e «Servito», chiusura del tavolo e conto.
- [ ] Ordine da casa di prova **solo se** Daniel ha già confermato gli allergeni: turno e zona di prova, un ordine accettato e completato, poi la pulizia. Senza allergeni confermati il punto si rimanda: **non** si confermano allergeni finti sul DB reale.
- [ ] Pulizia: le query si mostrano all'utente e si eseguono solo con il suo consenso esplicito (ordini, sessioni, turni e zone di prova).
- [ ] Capacità per fascia: è ancora a 2 ordini e 1 domicilio dalla prova della tappa 3; Daniel imposta i valori veri da `/admin/domicilio`.
