# Tappa 4 — Messa online — design

Data: 2026-10-13 · Stato: in revisione · Spec generale: [`2026-10-11-gestionale-ordini-design.md`](2026-10-11-gestionale-ordini-design.md) (§7, §8, §9)

## 1. Obiettivo

Clienti e staff usano l'app da internet, in modo sicuro, e il locale la prova davvero prima di aprirla al pubblico. Gli ordini da casa si aprono solo quando Daniel ha inserito i suoi dati (allergeni in testa).

**Successo:**
- **Fase A:** l'app è pubblicata su un indirizzo provvisorio di Vercel. Una prova in sala con telefoni veri e il tablet chiude un tavolo dal QR al conto, e un ordine da casa di prova va dall'invio al ritiro.
- **Fase B:** l'app risponde su `ordini.danielsushi.it` e il sito su `danielsushi.it`. Le email partono da un indirizzo `@danielsushi.it` e i QR definitivi sono stampati.

## 2. Decisioni prese con l'utente (2026-10-13)

| Tema | Decisione |
|---|---|
| Hosting | **Vercel Pro** (20 $/mese + IVA): il piano gratuito vieta l'uso commerciale |
| Dominio | **`danielsushi.it`**, intestato a Daniel o alla sua attività. Lo registrano l'utente e Daniel presso un registrar italiano, perché Vercel non vende i `.it`. Libero al whois del NIC il 13/10/2026 |
| Percorso | **Due fasi.** A: app online su indirizzo provvisorio, con prova in sala e QR provvisori su carta. B: dominio, email e QR definitivi, appena il dominio c'è |

Scelte tecniche (di Claude, su delega dell'utente):
- App su `ordini.danielsushi.it` e sito statico su `danielsushi.it` (+ `www`), anch'esso su Vercel nello stesso team.
- DNS gestito da Vercel: Daniel imposta una volta i nameserver di Vercel nel pannello del registrar. I record per l'app, il sito e Resend si gestiscono poi dal team Vercel, senza accedere all'account del registrar.
- Funzioni a Francoforte (`fra1`), vicino al database (Supabase `eu-central-1`).

## 3. Stato di partenza (verificato il 2026-10-13)

- `main` = `6f82aec` (tappe 1–3, 62 file e 285 test). Branch di questa tappa: `tappa-4-online`.
- DB reale: 5 migrazioni, 3 ordini da tavolo, 0 piatti con allergeni confermati, capacità 2/1 rimasta dalla prova della tappa 3.
- Nessun deploy. Team Vercel `carnedasosas-projects`, già su **Pro** (confermato dall'utente il 13/10), nessun progetto collegato al repo.
- Connessione al pooler **senza TLS** (`src/server/db.ts`). Prova in sola lettura del 13/10: il pooler `aws-1-eu-central-1.pooler.supabase.com:6543` presenta `*.pooler.supabase.com`, firmato da «Supabase Intermediate 2021 CA» → «Supabase Root 2021 CA». Con il certificato pubblico `prod-ca-2021.crt` e `rejectUnauthorized: true` la connessione riesce e il nome host è verificato.
- Vercel esegue le funzioni in `iad1` (Washington) se non si indica una regione.
- Login dello staff: Supabase Auth con email e password (`signInWithPassword`, `getClaims`). Nessun link via email.
- Nessun test end-to-end: la spec generale (§8) li prevedeva, finora c'erano solo prove a mano.
- Sito statico (`carnedasosa/daniel-sushi`): PR #4 aperta. Con `js/ordini.js` vuoto i bottoni «Ordina» portano a `#dove` (comportamento attuale). Il sito non è ancora pubblicato.

## 4. Fase A — online su indirizzo provvisorio

### 4.1 Connessione cifrata al database

- `src/server/tls-db.ts` (nuovo) esporta `opzioniTls(url)`:
  - host `localhost`, `127.0.0.1` o `::1` → `false` (PGlite e server finti dei test);
  - qualsiasi altro host → `{ ca: CA_SUPABASE_2021, rejectUnauthorized: true }`. Node verifica anche il nome host.
- **Errore esplicito** se l'URL contiene `sslmode`: in `pg` i parametri dell'URL sovrascrivono l'opzione `ssl` e annullerebbero la verifica.
- `CA_SUPABASE_2021` è il certificato pubblico «Supabase Root 2021 CA», salvato come stringa in `src/server/ca-supabase.ts`. È un file di codice, non letto da disco: così Vercel non deve tracciare file extra.
  - Impronta SHA-256 annotata nel file e verificata da un test.
  - Va confrontata una volta con il certificato scaricato dal dashboard Supabase (Database → SSL Configuration).
- `src/server/db.ts` e gli script che usano `pg` (`scripts/assegna-ruolo.ts`, `scripts/verifica-poke-postgres.ts`) usano `opzioniTls`.
- Nessuna modifica a `DATABASE_URL` né alle impostazioni di Supabase. L'«Enforce SSL» del progetto resta come oggi: attivarlo riavvia il database e non serve, perché il client rifiuta già connessioni non verificate.

### 4.2 Configurazione Vercel

- `vercel.json`: `"regions": ["fra1"]`, oltre al cron già presente (`/api/cron/anonimizza`, `0 3 * * *`).
- Variabili di **Production**:
  - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET` (≥ 16 caratteri casuali);
  - `APP_URL` = indirizzo provvisorio di produzione (`https://<progetto>.vercel.app`).
  - `RESEND_API_KEY` ed `EMAIL_MITTENTE` restano **vuote** in fase A: le email sono spente, la pagina dello stato funziona.
  - `ORDINI_CASA_PROVA` **mai** impostata su Vercel. È già ignorata in produzione.
- Le **Preview** di Vercel non ricevono `DATABASE_URL`: nessuna anteprima di un branch scrive sul database reale.
- **Chi fa cosa**, per le regole sui segreti e sui pagamenti:

  | Passo | Chi |
  |---|---|
  | Valori segreti (`DATABASE_URL`, `CRON_SECRET`) nel dashboard di Vercel | L'utente |
  | Creazione del progetto collegato al repo, regione, variabili non segrete, verifica del deploy | Claude o Codex, dopo conferma |

### 4.3 Prove end-to-end (Playwright)

- **Dipendenze di sviluppo**, con versioni esatte fissate nel piano:
  - `@playwright/test`, solo Chromium;
  - **niente `@electric-sql/pglite-socket`**: nella verifica del 13/10 alternava i singoli messaggi di connessioni diverse (errore `bind message supplies 3 parameters…` con lo schermo staff). Al suo posto un piccolo server in `e2e/server-pglite.ts` manda a PGlite blocchi interi di protocollo (fino a Sync o Query) e tiene PGlite alla connessione che ha una transazione aperta.
- **Ambiente:** `npm run e2e`.
  1. Avvia un PGlite in memoria esposto su `127.0.0.1` con tutte le migrazioni e il seed.
  2. Fa `next build` e `next start` con `DATABASE_URL` puntato lì. Va provata la build di produzione, non `next dev`.
  3. Lancia i test.
- **Non tocca mai il DB reale.**
  - Il login dello staff usa **Supabase Auth reale** con un utente di prova dedicato (`E2E_EMAIL`, `E2E_PASSWORD` in `.env.local`, mai nel repo). Lo crea l'utente dal dashboard Supabase; il ruolo `admin` gli viene dato solo nel PGlite.
  - Sul DB reale quell'utente non ha nessun ruolo.
- **Percorso tavolo:**
  1. L'admin apre un tavolo.
  2. Due pagine con viewport da telefono (375×812) entrano dal link del QR, inseriscono il codice e mandano un ordine ciascuna, una con poke composta.
  3. Lo staff vede gli ordini, li porta a «servito» e chiude il tavolo con il riepilogo del conto.
  4. Un nuovo accesso col vecchio codice è rifiutato.
- **Percorso da casa:**
  1. Seed con allergeni confermati, una zona e un turno di oggi.
  2. Lo staff accende «Ordini online».
  3. Il cliente (375×812) ordina a domicilio.
  4. Lo staff accetta con +15'.
  5. La pagina dello stato mostra «Confermato» con l'orario spostato entro 15 s.
  6. Lo staff porta l'ordine a «Consegnato».
- **Limite noto:** le fasce non attraversano la mezzanotte. Dopo le 23:00 di Roma il percorso da casa si salta con un messaggio esplicito, invece di fallire.
- `npm test` (Vitest) resta separato e non richiede Playwright.

### 4.4 Pubblicazione e controlli

1. Merge di `tappa-4-online` su `main`, poi primo deploy di produzione da `main`.
2. Controlli dopo il deploy (verbale in `docs/verifiche/`):
   - `/` risponde e il menù è leggibile;
   - con il DB reale gli ordini da casa risultano **chiusi**, come voluto, perché gli allergeni non sono confermati;
   - login staff e admin (l'utente inserisce la password);
   - nei log delle funzioni la regione è `fra1` e non ci sono errori TLS;
   - `/api/cron/anonimizza` risponde 401 senza segreto. Dopo la prima notte, il log mostra l'esecuzione delle 03:00 UTC (05:00 di Roma, ora legale).

### 4.5 Prova in sala

Con il locale chiuso, l'utente con Daniel o lo staff segue una lista che il piano fornisce, da compilare e mettere nel verbale:

- QR provvisori dei tavoli stampati da `/admin/tavoli` (carta normale).
- Due o tre telefoni diversi (iPhone e Android, rete del locale e rete mobile): QR → codice → ordine, poke inclusa.
- Tablet dello staff: arrivo degli ordini, suono, passaggi di stato, chiusura del tavolo e conto.
- Un ordine da casa di prova. Sul DB reale serve un turno di prova, una zona di prova e gli allergeni confermati, da annullare a fine prova.
  - Se Daniel non ha ancora confermato gli allergeni, questo punto si rimanda: **non** si confermano allergeni finti sul DB reale.
- Pulizia finale: le query sono mostrate all'utente prima di eseguirle. Ordini e sessioni di prova si annullano o si cancellano solo con il suo consenso esplicito, come nella tappa 3.

## 5. Fase B — dominio, email e QR definitivi (piano separato)

Parte quando il dominio è registrato. Il suo piano si scrive allora, perché dipende da registrar e date. Contenuto previsto:

- **Nameserver di Vercel** nel pannello del registrar (lo fa chi ha l'accesso).
  - Dominio aggiunto al team Vercel.
  - `ordini.danielsushi.it` sul progetto dell'app.
  - `danielsushi.it` e `www` su un nuovo progetto Vercel per il sito statico.
- **Sito:**
  - merge della PR #4 del sito;
  - `js/ordini.js` = `https://ordini.danielsushi.it`.
- **App:**
  - `APP_URL` = `https://ordini.danielsushi.it`;
  - Site URL di Supabase Auth aggiornato;
  - nuovo deploy.
- **Email con Resend (piano gratuito):**
  - verifica di `danielsushi.it` con i record DNS indicati da Resend;
  - `EMAIL_MITTENTE` = `Daniel's Sushi <ordini@danielsushi.it>`;
  - `RESEND_API_KEY` inserita dall'utente;
  - prova con un ordine e un indirizzo dell'utente.
- **QR definitivi** stampati con il nuovo indirizzo. Quelli provvisori vanno buttati: puntano al `vercel.app`, che continua a funzionare ma non è l'indirizzo del locale.
- **Apertura al pubblico** solo dopo i dati di Daniel (§9 della spec generale): allergeni, orari, zone, capacità, telefono, prezzi della poke, testo della privacy.

## 6. Errori e casi limite

- **Certificato non valido o `sslmode` nell'URL:** l'app non si connette e lo dice nel log, senza ripiegare su una connessione in chiaro.
- **Rotazione del CA da parte di Supabase:** «Supabase Root 2021 CA» scade il 26/04/2031. Una nuova CA richiede un aggiornamento di `ca-supabase.ts`, e l'errore TLS nei log lo rende evidente.
- **Database in pausa:** l'org Supabase è gratuita e un progetto inattivo viene sospeso. Con l'app in uso e il cron giornaliero che interroga il database non succede, ma va ricontrollato se il locale chiude per ferie lunghe.
- **Limiti delle email (fase B):** il piano gratuito di Resend consente 100 email al giorno e 3.000 al mese. Un ordine ne genera fino a due, quindi circa 50 ordini al giorno. Oltre, Resend Pro costa 20 $/mese (decisione dell'utente, se servirà).
- **Preview:** senza `DATABASE_URL` le pagine che leggono il DB falliscono. È voluto: le anteprime servono solo per il layout.

## 7. Test

- **Unità:**
  - `opzioniTls`: localhost senza TLS, host remoto con CA e verifica, errore con `sslmode`;
  - impronta del certificato.
- **Integrazione:** il pool di `db.ts` con `opzioniTls` contro il server Postgres finto locale (nessun TLS), già usato da `db.integrazione.test.ts`.
- **Verifica manuale in sola lettura sul DB reale:** `select 1` con TLS verificato, già riuscito il 13/10, da ripetere dopo la modifica.
- **End-to-end:** §4.3.
- La suite esistente (62 file, 285 test) resta verde.

## 8. Fuori da questa tappa

Monitoraggio e avvisi (oltre ai log di Vercel) · backup aggiuntivi oltre a quelli giornalieri di Supabase · «Enforce SSL» lato Supabase · test end-to-end in CI su GitHub · statistiche · quanto già escluso dalla v1 (§10 della spec generale).
