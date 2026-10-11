# Correzioni tappa 2 — Implementation Plan

> **Per chi esegue (Codex o altro agente):** esegui questo piano task per task, nell'ordine, spuntando le checkbox `- [ ]`. **Prima di tutto leggi e rispetta la sezione «Come lavorare» di `docs/superpowers/plans/2026-10-11-tappa-2-tavolo.md`**: vale identica anche qui (leggere prima di scrivere, docs di Next in `node_modules/next/dist/docs/`, TDD per la logica, verifica completa a fine task, commit piccoli in italiano, design system, regole di sicurezza, mai inserire password dell'utente, chiedere prima di toccare il database reale). Unica differenza: il branch.

**Goal:** Correggere i problemi trovati dalla revisione post-merge della tappa 2 prima di usare gli ordini al tavolo in servizio: ordini che spariscono alla chiusura del tavolo, conto non raggiungibile, ordini doppi con rete debole, limite ai tentativi aggirabile e tavolo bloccabile da remoto, schermo staff che si ferma su un errore di rete, più 14 rifiniture.

**Architecture:** Nessun cambio di architettura. Una nuova migrazione additiva; modifiche a repo, azioni e componenti esistenti della tappa 2.

**Spec:** `docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md` (§4.2, §4.3, §5). **Piano originale:** `docs/superpowers/plans/2026-10-11-tappa-2-tavolo.md`.

## Branch e consegna

- Il branch esiste già e contiene questo piano: `git fetch && git checkout correzioni-tappa-2 && git pull`. Se nel frattempo `main` è andato avanti, `git merge origin/main` prima di iniziare.
- Alla fine: push e PR verso `main` in italiano, con l'elenco dei punti chiusi (I1–I5, M1–M15) e le verifiche fatte.

## Global Constraints

- Valgono tutti i Global Constraints del piano della tappa 2 (versioni, niente `cacheComponents`, env solo server, codice a 4 cifre, stati, quantità/note).
- **Nuova migrazione** `supabase/migrations/20261012180000_correzioni_tavolo.sql`; le migrazioni esistenti (`20261011120000_…`, `20261012120000_…` o comunque quelle già nel repo) **non si toccano**. La nuova deve applicarsi sia su un DB vuoto dopo le precedenti (test PGlite) sia sul DB reale che ha già 2 tavoli e una sessione aperta.
- Nuove regole sui tentativi (sostituiscono quelle della tappa 2): i tentativi sono legati alla **sessione aperta** (riaprire il tavolo li azzera); blocco se, negli ultimi 10 minuti e per quella sessione, **dispositivo ≥ 5 errori** oppure **IP ≥ 5 errori**; il tetto di **30 errori per sessione** blocca **solo** dispositivi/IP che hanno almeno un errore (chi non ha mai sbagliato entra sempre col codice giusto).
- Gli URL dei tavoli diventano **non indovinabili**: `/tavolo/<chiave>` con `chiave` casuale di 12 caratteri `[a-z0-9]` (≥ 60 bit), generata con `crypto` lato server; lo slug resta solo per l'admin.

## Stato verificato del database reale (12/10/2026)

`poke_config.gruppi` è un array JSON di 5 gruppi (corretto), prezzi poke `null` (poke composta non ordinabile finché Daniel non li imposta), 2 tavoli, **1 sessione ancora aperta da una prova**, 0 ordini, 139 piatti. Il punto I6 della revisione è quindi chiuso sul DB; resta solo l'irrobustimento del codice (M15).

---

### Task 1: Igiene del repository

- [x] Aggiungi a `.gitignore` la riga `.superpowers/` (cartella di lavoro degli agenti, contiene report: oggi non è ignorata e un `git add .` la pubblicherebbe nel repo pubblico). Verifica con `git check-ignore -v .superpowers/qualcosa`.
- [x] Commit.

### Task 2: Migrazione — chiave QR, tentativi per sessione e IP, chiave d'invio

**File:** `supabase/migrations/20261012180000_correzioni_tavolo.sql`, test in `tests/db/schema.test.ts` (o nuovo `tests/db/correzioni.test.ts`).

Contenuto richiesto (adatta i nomi solo se il codice reale della tappa 2 usa nomi diversi):
```sql
-- Chiave non indovinabile per l'URL del QR (le righe esistenti ricevono una chiave casuale)
alter table public.tavoli add column chiave text;
update public.tavoli set chiave = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) where chiave is null;
alter table public.tavoli alter column chiave set not null;
alter table public.tavoli add constraint tavoli_chiave_formato check (chiave ~ '^[a-z0-9]{12}$');
create unique index tavoli_chiave_unica on public.tavoli (chiave);

-- Tentativi legati alla sessione e all'IP
alter table public.tentativi_codice add column sessione_id uuid references public.sessioni_tavolo (id) on delete cascade;
alter table public.tentativi_codice add column ip text;
create index tentativi_sessione_tempo on public.tentativi_codice (sessione_id, creato_il);

-- Invio idempotente degli ordini
alter table public.ordini add column chiave_invio uuid;
create unique index ordini_chiave_invio_unica on public.ordini (chiave_invio) where chiave_invio is not null;
```
(`gen_random_uuid()` è casuale crittograficamente in Postgres ≥ 13 ed è disponibile anche in PGlite. I nuovi tavoli ricevono la chiave dall'applicazione, Task 3.)

- [ ] Test PGlite: dopo tutte le migrazioni, un tavolo creato prima della nuova migrazione (inseriscilo applicando le migrazioni una alla volta, oppure verifica l'`update` con una riga inserita prima di eseguire il file) ha una chiave valida; chiave duplicata rifiutata; due ordini con la stessa `chiave_invio` rifiutati, con `null` ammessi più volte.
- [ ] Commit.

### Task 3: URL del tavolo con chiave e limite ai tentativi corretto (I4, M13)

**Modifica:** `src/tavoli/repo.ts` (+test), `src/domain/limiti-tentativi.ts` (+test), `src/app/tavolo/[slug]` → rinomina la cartella in `src/app/tavolo/[chiave]` (e tutti gli import/link), `src/tavoli/cookie.ts`, `src/app/admin/tavoli/*`, `src/app/admin/tavoli/stampa/page.tsx`.

- [ ] Repo: `creaTavolo` genera `chiave` con `crypto.randomBytes` → 12 caratteri `[a-z0-9]` (funzione pura `generaChiaveTavolo(rand?)` in `src/domain/` con test); `tavoloDaChiave(db, chiave)` sostituisce `tavoloDaSlug` per il lato cliente (formato non valido → `null` senza query); `rigeneraChiave(db, tavoloId)` per l'admin.
- [ ] Tentativi: `registraTentativoFallito(db, { tavoloId, sessioneId, dispositivo, ip })`; `contaErrori(db, { sessioneId, dispositivo, ip, minuti })` → `{ dispositivo, ip, sessione }` contati **solo sulla sessione**. Dominio: `bloccato({ dispositivo, ip, sessione })` = `dispositivo >= 5 || ip >= 5 || (sessione >= 30 && (dispositivo > 0 || ip > 0))`. Test: chi non ha mai sbagliato non è mai bloccato; riaprire la sessione azzera; IP diverso con stesso dispositivo bloccato comunque per dispositivo e viceversa; tentativo di 11 minuti fa ignorato.
- [ ] IP del client in `entraAlTavolo`: dall'header `x-forwarded-for` (primo valore, trim) o `x-real-ip`; se assente usa `'sconosciuto'`. Funzione pura `ipDaHeaders(headers)` con test. Se il cookie dispositivo manca, l'azione lo crea **e** conta comunque l'IP (il bypass senza cookie non funziona più).
- [ ] Cookie sessione: nome legato alla chiave (`ds_tavolo_<chiave>`), path `/tavolo/<chiave>`. M13: se il cookie punta a una sessione chiusa o di un altro tavolo, cancellalo; il messaggio «Il tavolo è chiuso, grazie…» compare solo se quella sessione era di **questo** tavolo e la sessione corrente è diversa o assente.
- [ ] Admin tavoli: mostra l'URL completo di ogni tavolo e un bottone secondario «Nuovo QR» (`rigeneraChiave`, con conferma «I QR stampati di questo tavolo smetteranno di funzionare»). Stampa QR con `/tavolo/<chiave>`.
- [ ] M9: in `/admin/tavoli/stampa`, se `APP_URL` non è impostata mostra un avviso («Imposta APP_URL per stampare QR definitivi: ora uso <origin>»); il protocollo ricavato rispetta `http` per `localhost`/`127.0.0.1`.
- [ ] Schermo staff: nella card del tavolo aperto, se ci sono errori di codice negli ultimi 10 minuti mostra «N tentativi sbagliati» e un bottone secondario «Sblocca» che elimina i tentativi della sessione (azione con `richiediRuolo('staff')`).
- [ ] Test azioni aggiornati + **un test end-to-end del limite su PGlite** (M11): repo reale, 5 errori dallo stesso dispositivo → bloccato anche col codice giusto; nuovo dispositivo con IP diverso entra.
- [ ] Verifica, commit.

### Task 4: Invio ordine idempotente (I3, M14, M8)

**Modifica:** `src/tavoli/ordini-repo.ts` (+test), `src/app/tavolo/[chiave]/azioni.ts` (+test), `MenuOrdinabile.tsx`/`Carrello.tsx`, `src/domain/carrello.ts` se serve.

- [ ] Client: genera `chiaveInvio = crypto.randomUUID()` quando il carrello cambia (aggiunta/rimozione/quantità/nota) e la salva insieme al carrello in `sessionStorage`; ogni tentativo d'invio dello **stesso** carrello riusa la stessa chiave; dopo un invio riuscito il carrello si svuota e la chiave si scarta.
- [ ] `inviaOrdine(chiave, carrelloJson, chiaveInvio)`: valida UUID; `creaOrdineTavolo(db, sessioneId, righe, chiaveInvio)`: dentro la transazione, se esiste già un ordine con quella `chiave_invio` **della stessa sessione** restituisce `ok: true` con quell'ordine (senza crearne un altro); se appartiene a un'altra sessione → errore generico. Gestisci anche la violazione dell'indice unico (23505) rileggendo l'ordine.
- [ ] Messaggio d'errore di rete sul client: «Non siamo sicuri che l'ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.»
- [ ] M14: prima dell'invio e a ogni refresh, rivalida sul client le righe poke con `validaPoke` e la `config` aggiornata; le righe non più valide si evidenziano («Questa poke va ricomposta») e bloccano l'invio finché non vengono tolte o rifatte; il server resta l'autorità.
- [ ] M8: il messaggio «Ordine n. X inviato in cucina» sparisce da solo dopo 6 secondi (e resta annunciato con `role="status"`).
- [ ] Test repo: stessa chiave due volte → un solo ordine, stesso numero restituito; chiave usata da un'altra sessione → errore, nessun ordine; chiave `null`/assente non ammessa dall'azione.
- [ ] Verifica, commit.

### Task 5: Chiusura tavolo, cucina e conto (I1, I2, M1–M6, M12)

**Modifica:** `src/tavoli/ordini-repo.ts`, `src/tavoli/repo.ts` (+test), `src/app/staff/azioni.ts` (+test), `SchermoStaff.tsx`, `src/app/staff/conto/[sessione]/page.tsx`.

- [ ] I1: `ordiniAttivi` non filtra più sulle sessioni aperte: mostra tutti gli ordini `inviato`/`in_preparazione` (la cucina li vede finché non sono serviti o annullati, anche a tavolo chiuso). La card indica «tavolo chiuso» se la sessione è chiusa.
- [ ] I1 (chiusura sicura): `chiudiSessione(db, sessioneId, contoVistoAlle: Date | null)` restituisce `{ ok: true }` oppure `{ ok: false, motivo: 'ordini_in_cucina', n }` / `{ ok: false, motivo: 'ordini_dopo_conto', n }`. Lo staff chiude in due modi: dal conto (Task 5, sotto) passando l'ora in cui il conto è stato caricato; dalla card con conferma. Se ci sono ordini ancora in cucina o arrivati dopo il conto, l'azione restituisce l'avviso e la UI chiede conferma esplicita («Ci sono 2 ordini ancora in cucina / 1 ordine arrivato dopo il conto: chiudere comunque?»); con `forza: true` chiude.
- [ ] I2: «Chiudi tavolo» porta alla pagina conto della sessione appena chiusa (`router.push('/staff/conto/<id>')` dopo l'esito ok). Nella pagina conto: se la sessione è aperta, bottone «Chiudi tavolo» (l'unico pieno) che usa `contoVistoAlle`; se è chiusa, scritta «Tavolo chiuso alle HH:MM». Nella sezione Tavoli dello schermo staff aggiungi «Conti recenti»: le sessioni chiuse nelle ultime 6 ore con link al conto.
- [ ] M5: la pagina conto si aggiorna da sola (`AggiornamentoAutomatico ogniSecondi={10}`) finché la sessione è aperta.
- [ ] M2: nella pagina conto, ogni voce ha «Annulla» (secondario, con conferma) che annulla le righe corrispondenti anche di ordini già serviti; il totale si ricalcola. Serve una funzione repo che annulli le righe raggruppate (per sessione + identità della voce) in transazione.
- [ ] M4: le righe «Poke composta» nel conto non vengono raggruppate tra loro se le scelte differiscono, e mostrano le scelte sotto il nome (testo piccolo, `--inchiostro-tenue`).
- [ ] M1: se annullando una riga un ordine resta senza righe attive, l'ordine passa a `annullato` (stessa transazione).
- [ ] M3: il conteggio ordini nella card del tavolo esclude gli annullati (aggiorna anche il test che oggi si aspetta 2).
- [ ] M6: `SchermoStaff` al primo montaggio considera «già visti» gli ordini presenti senza suonare; suona ed evidenzia solo quelli comparsi dopo.
- [ ] M12: in `inviaOrdine` sostituisci `elencoTavoli(tx)` sotto lock con una query mirata al solo tavolo/sessione.
- [ ] Test repo (PGlite) per ogni punto sopra; test azioni con mock per i rami di `chiudiTavolo`.
- [ ] Verifica, commit.

### Task 6: Schermo staff resistente alle cadute di rete (I5)

**Modifica:** `src/componenti/AggiornamentoAutomatico.tsx`, `src/app/staff/page.tsx`, `src/app/staff/error.tsx`, `src/app/tavolo/[chiave]/error.tsx`, eventuale nuova route `src/app/stato/route.ts`.

- [ ] Aggiungi una route leggera `GET /stato` (route handler, `export const dynamic = 'force-dynamic'` se serve secondo le docs) che risponde `204` senza toccare il DB; `AggiornamentoAutomatico` prima di ogni `router.refresh()` fa `fetch('/stato', { cache: 'no-store' })` con timeout 4 s (`AbortController`): se fallisce **non** chiama `router.refresh()` (evita il ripiego di Next su una navigazione completa) e mostra il banner «Connessione assente: i dati potrebbero non essere aggiornati» con l'ora dell'ultimo aggiornamento riuscito; appena torna la connessione fa subito un refresh e toglie il banner. Mantieni pausa/ripresa su `visibilitychange`.
- [ ] `src/app/staff/page.tsx`: le letture dal DB sono in `try/catch` (non attorno a `richiediRuolo`); se falliscono la pagina rende comunque `AggiornamentoAutomatico`, l'intestazione e il banner «Database non raggiungibile, riprovo da solo…» invece di lanciare l'errore.
- [ ] `error.tsx` di staff e tavolo: oltre a «Riprova», ritentano da soli con `retry()` ogni 10 secondi (mostrando «Nuovo tentativo tra N s»).
- [ ] `InizioTurno`: se l'`AudioContext` è stato chiuso o sospeso (rimontaggio dopo errore), mostra un bottone «Riattiva suono» ben visibile invece di restare muto in silenzio.
- [ ] Test unitari della logica di stato del componente estratta in una funzione pura (es. `prossimoStatoConnessione(stato, esitoFetch, ora)`); typecheck e build.
- [ ] Verifica, commit.

### Task 7: Irrobustimento poke e pulizie (M7, M10, M15)

- [ ] M15: `leggiPokeConfig` valida la forma letta (`gruppi` array di oggetti con `nome`, `voci` string[], `min`/`max`/`inclusi` interi); se non valida logga `console.error('poke_config non valida')` e restituisce `null`. `MenuOrdinabile` monta `ComponiPoke` **solo** se `pokeOrdinabile(config)`. Test con una riga `gruppi` salvata come stringa JSON (`'"[]"'::jsonb`) → `null` e pagina che non si rompe.
- [ ] M7: rimuovi l'azione server esportata e non usata `leggiOrdinatoFinora` (o usala davvero); nessuna azione server inutilizzata deve restare esportata.
- [ ] M10: i test «concorrenti» su PGlite non esercitano la concorrenza reale (PGlite serializza le transazioni): rinominali in modo onesto (es. «due inserimenti in sequenza non violano…») e aggiungi un commento che spiega il limite; la garanzia reale resta negli indici unici e nei `for update`.
- [ ] Verifica, commit.

### Task 8: Database reale, prova nel browser, consegna

- [ ] **Chiedi all'utente** prima di applicare `20261012180000_correzioni_tavolo.sql` al progetto Supabase `daniel-sushi` (ref `rxsywhdznaugfhmsdjsa`). Dopo: advisor di sicurezza (atteso solo «RLS enabled, no policy»), `select id, chiave from tavoli` per confermare le chiavi.
- [ ] **Chiedi all'utente** se chiudere la sessione di prova rimasta aperta (stato verificato sopra).
- [ ] Prova nel browser (l'utente fa da sé i login; per il cliente usa una scheda senza cookie di login):
  1. Admin tavoli: URL con chiave, «Nuovo QR» cambia l'URL e il vecchio dà 404; pagina stampa con avviso `APP_URL` se assente.
  2. Cliente: vecchio URL `/tavolo/tavolo-1` → 404; nuovo URL → codice → menù.
  3. 5 codici sbagliati → blocco; da staff «Sblocca» → si entra; chiudere e riaprire il tavolo azzera i tentativi.
  4. Invio ordine, poi simula rete persa (DevTools offline o `navigator` emulato) e ritenta: un solo ordine in cucina.
  5. Staff: ordine in preparazione, «Chiudi tavolo» → avviso «1 ordine ancora in cucina», confermando si apre il conto; l'ordine resta nella colonna cucina con «tavolo chiuso»; «Conti recenti» mostra il conto.
  6. Conto: annulla una voce di un ordine servito → totale ricalcolato; poke con scelte visibili.
  7. Schermo staff: con la rete disattivata compare il banner con l'ora dell'ultimo aggiornamento, nessuna pagina di errore del browser; riattivata la rete si riallinea da solo.
  8. Tutte le pagine toccate a 375 px senza scroll orizzontale; CSS caricato.
- [ ] Pulisci i dati di prova **chiedendo prima all'utente**.
- [ ] `npm test && npm run typecheck && npm run lint && npm run build` verdi senza flag; push del branch `correzioni-tappa-2` e PR verso `main` in italiano.
