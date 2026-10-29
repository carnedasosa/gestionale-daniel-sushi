# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Gestionale ordini di Daniel's Sushi (Bitetto): menù pubblico, ordini al tavolo con QR + codice, asporto/domicilio, schermo cucina/staff e admin. Next.js 16 (App Router) + React 19 + TypeScript, Postgres su Supabase, deploy su Vercel (`fra1`). Codice, nomi, commenti, commit e testi dell'interfaccia sono **in italiano**: mantieni questa lingua.

Next.js 16 ha API diverse da quelle note (es. `src/proxy.ts` al posto di `middleware.ts`): vedi `AGENTS.md` e le guide in `node_modules/next/dist/docs/` prima di scrivere codice Next.

## Comandi

```bash
npm run dev            # http://localhost:3000 (serve .env.local, vedi .env.example)
npm test               # vitest run: unit + test SQL su PGlite
npx vitest run src/tavoli/repo.test.ts        # un solo file
npx vitest run -t "crea tavoli"               # un solo test per nome
npm run typecheck      # tsc --noEmit
npm run lint
npm run build
npm run e2e            # Playwright sulla build di produzione + DB finto PGlite (porte 3100 e DB in e2e/dati.ts)
npm run serata         # simulazione lunga di una serata (playwright.serata.config.ts)
npm run seed           # rigenera supabase/seed.sql da data/menu-sito.json
npm run ruolo -- <email> admin|staff          # assegna un ruolo sul DB reale
```

La CI (`.github/workflows/ci.yml`) esegue typecheck, lint, test, e2e e serata su ogni PR; i due job sono controlli obbligatori su `main`. Gli e2e richiedono `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `E2E_EMAIL`, `E2E_PASSWORD` in `.env.local` (utente di prova reale su Supabase Auth, ruolo admin solo nel DB finto) e `npx playwright install chromium` la prima volta. Su Windows `npm ci` fallisce con EPERM se è acceso un `next dev`/`next start` del progetto.

## Architettura

**Accesso ai dati: SQL diretto dal server, mai Supabase dal browser.** Supabase serve solo per l'autenticazione (`@supabase/ssr`, `src/lib/supabase/`). I dati passano dal driver `pg` (`src/server/db.ts`, `server-only`) verso il transaction pooler, con TLS verify-full sul CA di Supabase (`src/server/tls-db.ts`, `ca-supabase.ts`). Le tabelle hanno RLS attiva e privilegi API revocati. Nessun Realtime: le schermate si aggiornano con `router.refresh()` a intervalli (staff 5 s, tavolo 10 s), dopo un controllo della connessione su `GET /stato`.

**Interfaccia `Db`** (`src/server/db-tipi.ts`): solo `query()` e `transazione()`. In produzione la implementa `adattaPool` (`db-adapter.ts`); nei test la implementa PGlite (`tests/db/pglite.ts`). Ogni repository riceve il `db` come primo argomento, così è testabile su un Postgres vero in memoria.

**Strati** (dal più puro al più esterno):
- `src/domain/` — logica pura senza I/O (carrello, poke, fasce orarie, soldi in centesimi, stati di tavolo/casa, ora di Roma, limiti dei tentativi). Test unitari accanto a ogni file.
- `src/menu/`, `src/tavoli/`, `src/casa/`, `src/auth/` — repository SQL (`*-repo.ts`, `repo.ts`) e servizi per area: menù, tavoli/ordini al tavolo, ordini da casa (impostazioni, coda email Resend, cron di anonimizzazione).
- `src/cassa/` (coperto, pagamenti, pre-conto), `src/stampa/` (coda di stampa `stampe`, biglietti e ESC/POS puri, instradamento, API per il ponte), `src/fiscale/` (documento commerciale neutro, driver Epson `fpmate.cgi`, scontrini). Il ponte di stampa del locale è `scripts/ponte-stampa.ts` (solo trasporto, Node senza dipendenze). Un lavoro fiscale senza esito non si riaccoda mai da solo: diventa «incerto».
- `src/app/**/azioni.ts` — Server Actions (`'use server'`): **prima istruzione sempre `await richiediRuolo('admin'|'staff')`** per le aree protette, poi validazione, repository, `revalidatePath`. Gli errori del DB si registrano con `console.error(err.message)` e diventano messaggi in italiano nello stato restituito.
- `src/app/` — route: `(cliente)` (menù pubblico `/`, `/ordina`, `/ordine/[token]`), `tavolo/[chiave]`, `staff`, `admin`, `accesso`, `api/cron/anonimizza`.
- `src/componenti/`, `src/ordinare/` — componenti condivisi; `src/ordinare/` contiene carrello, card e composizione poke usati sia al tavolo sia da casa.

**Autorizzazione**: `src/proxy.ts` aggiorna la sessione Supabase su `/admin`, `/staff`, `/accesso`; il controllo vero è `richiediRuolo` (`src/auth/sessione.ts`) in ogni layout e azione protetti. Ruoli in tabella `profili`: `admin` include `staff`.

**Regole di dominio che il codice difende**: prezzi e totali sono sempre ricalcolati sul server (se cambiano, l'ordine non parte); invii idempotenti tramite chiave di invio unica; l'ultimo posto in una fascia è protetto dal lock sulle impostazioni; gli ordini da casa richiedono allergeni confermati per tutti i piatti disponibili (Reg. UE 1169/2011), aggirabile solo in locale con `ORDINI_CASA_PROVA=1`. Le garanzie di concorrenza stanno in indici unici e lock Postgres: PGlite serializza le transazioni e non le prova.

**Stile**: design system «Banco» in `src/styles/banco/` (token CSS `--b-*` in `token.css`, chiaro/scuro/stampa). `contrasto.test.ts` verifica il contrasto WCAG AA di ogni coppia di token: aggiungendo colori, aggiorna anche le coppie lì. CSS per area accanto alle route (`staff.css`, `admin.css`, `casa.css`, …).

## Test

- Vitest in ambiente `node`, timeout 60 s (i file PGlite sono lenti in parallelo). `server-only` è sostituito da uno stub in `vitest.config.mts`.
- Repository: `creaDbDiTest({ seed?, primaDi? })` crea un PGlite con lo stub di `auth`/ruoli Supabase, **tutte le migrazioni reali** e opzionalmente il seed; chiudi con `pg.close()` in `afterEach`. `primaDi` serve a testare una migrazione partendo dallo schema precedente.
- Server Actions: si moccano `@/auth/sessione`, `@/server/db`, i repository e `next/cache` con `vi.hoisted` + `vi.mock`; i test controllano che `richiediRuolo` sia chiamato prima di ogni accesso ai dati (`invocationCallOrder`).
- E2E: `e2e/db-locale.ts` avvia un PGlite esposto via `e2e/server-pglite.ts`; il database reale non viene mai toccato.

## Database e migrazioni

- Migrazioni in `supabase/migrations/` (ordinate per nome, applicate nell'ordine anche da test ed e2e). Il seed è per un database vuoto: non rieseguirlo sul DB reale.
- Applicare una migrazione al DB reale è un'azione da far autorizzare all'utente. Il connettore Supabase MCP non vede il progetto: per il DB reale si usano script `tsx --env-file=.env.local` (es. `scripts/applica-sql.ts`) con `src/server/tls-db`.
- Le Preview Vercel non hanno `DATABASE_URL`: nessuna anteprima scrive sul DB reale.

## Documentazione di progetto

Specifiche in `docs/superpowers/specs/`, piani di lavoro in `docs/superpowers/plans/`, verbali delle verifiche in `docs/verifiche/`. Il README descrive in dettaglio il comportamento di tavoli, schermo staff, ordini da casa ed email.
