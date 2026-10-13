# Verifica della tappa 4 — fase A

Data: 2026-10-13 · Branch: `tappa-4-online`

Parte 1 eseguita sul commit iniziale `5839c05`, secondo il piano, nell'ordine dei task. Codice copiato dai blocchi prescritti, senza modifiche ulteriori. La Parte 2 è riservata a Claude con l'utente dopo il merge.

| Task | Verifica |
| --- | --- |
| 0 — Preparazione | Albero pulito, branch e quattro commit iniziali conformi. Branch assente su GitHub: nessun pull necessario. `npm ci` riuscito; suite iniziale: 62 file, 285 test passati. Una configurazione non vuota per ciascuna credenziale E2E. Porte 3100 e 55432 libere. |
| 1 — TLS | Prima del codice: test TLS fallito per modulo CA mancante, come previsto; dopo: 5 test passati e impronta CA corretta. Test del pool prima: 2 falliti, 1 passato, come previsto. Dopo: 3 file, 13 test passati; typecheck e lint riusciti. Step 12, DB reale in sola lettura: `TLS verificato: true` e conteggio di 3 ordini. Nessuna scrittura, migrazione o pulizia sul DB reale. |
| 2 — Regione | Prima: fallimento atteso, regione undefined. Dopo: 1 test passato, regione `fra1` e cron invariato. |
| 3 — Tavolo | Installata soltanto la nuova devDependency esatta `@playwright/test` 1.63.0 con le sue dipendenze; altre versioni invariate. Chromium disponibile. Typecheck e lint riusciti; 64 file, 292 test passati. `npm run e2e`: 1 passed (49,4 s), percorso del tavolo su build di produzione e PGlite in memoria. Output di Playwright esclusi da Git. |
| 4 — Casa | Typecheck e lint riusciti. `npm run e2e`: 2 passed (37,4 s), nessun test saltato; ordine a domicilio accettato +15 minuti e seguito fino alla consegna, più percorso del tavolo. |
| 5 — Verifica finale | README e .env.example aggiornati con i blocchi prescritti. Suite finale: 64 file, 292 test passati; typecheck e lint riusciti. Build senza .env.local riuscita, presente `ƒ /api/cron/anonimizza`; .env.local ripristinato subito e assente da git status. Ultimo `npm run e2e`: 2 passed (38,7 s), nessun test saltato. |

## Scostamenti

Nessuno scostamento nel codice o negli esiti attesi. Adattamenti operativi per PowerShell su Windows: `npm.cmd`/`npx.cmd` al posto di `npm`/`npx`; conteggio con `Select-String` al posto di `grep`, senza stampare i valori. Per la build senza .env.local, ripristino garantito da `try/finally`.

`npm ci` ha segnalato la deprecazione della versione ESLint esistente e 5 vulnerabilità di severità alta; nessun aggiornamento di dipendenze effettuato, come richiesto dal piano. Playwright ha emesso avvisi NO_COLOR/FORCE_COLOR senza errori. Il fallimento iniziale del test TLS è riportato da Vitest come `Cannot find module './ca-supabase'`, equivalente al modulo mancante previsto.

## Parte 2 — pubblicazione e prova in sala

Eseguita da Claude con l'utente il 13/10/2026.

**Task 6 — Progetto e deploy.**

- Progetto Vercel `gestionale-daniel-sushi` (`prj_AAaNc9HP2za8k13lz4ZRQMfc0aBw`) nel team `carnedasosas-projects`, framework Next.js, repo `carnedasosa/gestionale-daniel-sushi`.
- Vercel Authentication era attiva su tutti i deploy tranne i domini personalizzati (`all_except_custom_domains`): l'app di produzione non sarebbe stata raggiungibile dai clienti. Portata a `preview`: produzione pubblica, anteprime solo per il team.
- Variabili, tutte e sole in Production:
  - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `APP_URL` = `https://gestionale-daniel-sushi.vercel.app`, impostate da Claude;
  - `DATABASE_URL` e `CRON_SECRET` «Sensitive», inserite dall'utente.
  - Nessuna variabile in Preview e Development. `RESEND_API_KEY`, `EMAIL_MITTENTE` e `ORDINI_CASA_PROVA` non impostate.
- Deploy di produzione da `main` (`7847e17`): build riuscita in circa 30 s, regione `fra1`. Ripubblicato dopo `APP_URL` (`dpl_6XfPJUMfvzQagv3d2B2By9pybojK`).

**Task 7 — Controlli dopo il deploy.**

- `/`, `/accesso`, `/privacy`, `/ordina` → 200; `/stato` → 204; risposte servite da `fra1` (`X-Vercel-Id: fra1::fra1::…`).
- Menù letto dal DB reale con TLS verificato: 139 piatti. A 375 px nessuno scroll orizzontale (larghezza pagina 375), console senza errori.
- Ordini da casa chiusi con l'avviso sugli allergeni (0 confermati): comportamento voluto.
- `GET /api/cron/anonimizza` senza segreto → 401.
- Login admin dell'utente (password inserita da lui).
  - `/admin/tavoli/stampa`: i QR puntano a `https://gestionale-daniel-sushi.vercel.app/tavolo/…`. Nel DB ci sono 2 tavoli.
  - `/staff`: turno avviato, tavoli, cucina e «Ordini online: chiusi» visibili. «Schermo sempre acceso non disponibile» nel browser integrato: da verificare sul tablet.
- Log delle funzioni nell'ultima ora: nessun errore o avviso (né TLS né `sslmode`).
- Da fare: esecuzione notturna del cron (03:00 UTC) da controllare nei log il giorno dopo.

**Task 8 — Prova in sala.** Da fare con l'utente e Daniel o lo staff, a locale chiuso.
