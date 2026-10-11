# Tappa 2 — Ordini al tavolo e schermo staff — Implementation Plan

> **Per chi esegue (Codex o altro agente):** esegui questo piano task per task, nell'ordine, con le checkbox `- [ ]`. Lavora **come avrebbe lavorato Claude nella tappa 1**: leggi la sezione «Come lavorare» prima di toccare il codice e rispettala alla lettera.

**Goal:** I clienti ordinano dal telefono al tavolo (QR + codice di 4 cifre), gli ordini arrivano su uno schermo staff in cucina/banco, lo staff apre/chiude i tavoli e vede il conto da battere in cassa; Daniel gestisce tavoli, QR e regole della poke.

**Architecture:** Stessa architettura della tappa 1. Next.js 16.4 App Router con rendering dinamico classico (`cacheComponents` **spento**), accesso al DB **solo lato server** tramite l'interfaccia `Db` (`src/server/db-tipi.ts`) e il driver `postgres` (`src/server/db.ts`), Supabase Auth solo per staff/admin. Logica di dominio in moduli puri testati con Vitest; SQL testato su PGlite con le migrazioni reali (`tests/db/pglite.ts`). Il «tempo reale» si ottiene con **aggiornamento periodico** (`router.refresh()` ogni pochi secondi) invece di Supabase Realtime: niente policy RLS per il browser, nessuna chiave esposta.

**Tech Stack:** Next.js 16.4.0 · React 19 · TypeScript · `postgres` 3.4.9 · `@supabase/ssr` 0.12.7 · Vitest 5.0.3 · `@electric-sql/pglite` 0.5.8 · `qrcode` 1.5.4 (+ `@types/qrcode` 1.5.6)

**Spec:** `docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md` — tappa 2 di §7; requisiti in §2, §4.2, §4.3, §4.4 (tavoli, poke), §5 (stati tavolo, poke, codice), §6, §8.

---

## Come lavorare (leggere prima di tutto)

Queste regole valgono per ogni task. Sono il modo in cui è stata fatta la tappa 1.

1. **Branch:** parti da `tappa-1-base` (PR #1 su GitHub, forse non ancora unita): `git checkout tappa-1-base && git pull && git checkout -b tappa-2-tavolo`. Se `tappa-1-base` è già stato unito in `main`, parti da `main`. Mai lavorare su `main`. Non fare push finché tutti i task non sono finiti e verificati.
2. **Leggi prima di scrivere.** Prima di ogni task leggi i file che tocchi e quelli citati in «Consumes». Per qualunque API di Next.js leggi la documentazione inclusa in `node_modules/next/dist/docs/` (lo chiede `AGENTS.md`: questa versione ha cambiamenti rispetto a quello che potresti ricordare: es. `proxy.ts` al posto di `middleware.ts`, `params`/`searchParams` sono Promise, `error.tsx` riceve `retry`). Non inventare API: verificale nei `.d.ts` in `node_modules`.
3. **TDD per la logica:** per ogni modulo di dominio o SQL scrivi prima il test, eseguilo e **guardalo fallire per il motivo atteso**, poi implementa, poi guardalo passare. Per le pagine React basta typecheck + build + verifica nel browser (Task 10).
4. **Verifica prima di dichiarare finito:** a fine task `npm test && npm run typecheck && npm run lint && npm run build` devono passare **senza flag**. La build deve passare senza `.env.local` (le pagine leggono il DB solo a richiesta). Output dei test pulito (niente warning).
5. **Commit piccoli, in italiano**, uno o più per task, descrittivi («Tavoli e sessioni: schema e codice a 4 cifre»). Non aggiungere righe `Co-Authored-By` di Claude: usa l'attribuzione del tuo strumento o nessuna.
6. **Interfaccia in italiano**, tono semplice e cortese. Prezzi con `formatEuro` (`10,50 €` con spazio indivisibile). Importi sempre **in centesimi interi**.
7. **Design system «Carta e indaco»:** solo token di `src/styles/ds/tokens.css` e classi di `src/styles/ds/bundle.css` (`ds-btn`, `ds-btn--primary`, `ds-btn--secondary`, `ds-card`, `ds-chip`, `ds-cats`, `ds-badge`, `ds-link`…). Niente colori, font, ombre o raggi nuovi. Indaco per la struttura; i caldi (arancio, miele, salvia) solo in blob/onde/bordi/badge. **Un solo bottone pieno (`ds-btn--primary`) per schermata.** Titoli con `.display`/`.heading*` (già indaco in `globals.css`). Classi nuove con prefisso dell'area: `tavolo-*` (cliente), `staff-*`, `admin-*`. Tutto deve funzionare a **375 px** senza scroll orizzontale della pagina.
8. **Sicurezza (non negoziabile):**
   - Il browser non tocca mai il DB. Ogni nuova tabella: `enable row level security` + `revoke all … from anon, authenticated`, nessuna policy.
   - Ogni pagina e ogni azione server dello staff chiama `await richiediRuolo('staff')` **come prima istruzione**; quelle admin `richiediRuolo('admin')`. Mai fidarsi solo di `proxy.ts` o del layout.
   - Il server **ricalcola sempre** prezzi, extra della poke e totali dal DB; il carrello del telefono è solo una proposta (id + quantità + nota + scelte poke).
   - Gli id che arrivano dal client (anche via `.bind`) si validano (UUID regex come in `src/menu/repo.ts`, `typeof` per i booleani).
   - Ogni `try/catch` attorno al DB **non** deve avvolgere `richiediRuolo` (i suoi `redirect` devono propagarsi); in caso di errore DB si restituisce un messaggio italiano e si logga solo `error.message`.
   - Mai stampare o committare segreti; `.env.local` resta fuori da git.
9. **Se il piano e il codice reale non coincidono** (un nome, una firma), vince il codice reale: adatta il minimo indispensabile e annotalo nel messaggio di commit. Se una scelta cambia il comportamento per l'utente, segui la spec.
10. **Quando hai finito tutto:** Task 11 (verifica finale) e poi push del branch e PR verso il branch base, con descrizione in italiano come la PR #1.

## Global Constraints

- Node 22, npm 11, nessun Docker. DB nei test: PGlite.
- Versioni già fissate in `package.json` (non aggiornarle). Nuove: `qrcode@1.5.4`, `@types/qrcode@1.5.6` (dev), installate con `--save-exact`.
- `next.config.ts` resta senza `cacheComponents`.
- Variabili d'ambiente solo server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`. Nessuna `NEXT_PUBLIC_*`.
- Migrazioni nuove in `supabase/migrations/` con prefisso timestamp successivo a `20261011120000`. Le migrazioni già applicate **non si modificano**.
- Codice del tavolo: 4 cifre `0000–9999`, casuale (`crypto.randomInt`), mai uguale a quello di un altro tavolo aperto; scade alla chiusura.
- Stati ordine al tavolo: `inviato` → `in_preparazione` → `servito`; `annullato` da `inviato` o `in_preparazione`. Righe annullabili singolarmente dallo staff.
- Tentativi di codice: massimo **5 errori per dispositivo per tavolo in 10 minuti** e **30 errori per tavolo in 10 minuti**; oltre: «Troppi tentativi, chiedi il codice al personale e riprova tra qualche minuto».
- Aggiornamento periodico: schermo staff ogni **5 s**, pagina tavolo («ordinato finora») ogni **10 s**; si ferma quando la scheda non è visibile e riparte quando torna visibile.
- Quantità per riga 1–20; nota per riga max 200 caratteri; max 40 righe per ordine.

## Review Focus

1. **Tavolo chiuso mentre il cliente ha il carrello pieno:** l'invio deve fallire con «Il tavolo è stato chiuso: chiedi al personale», senza creare ordini → test in Task 5.
2. **Piatto segnato esaurito dopo che il cliente l'ha messo nel carrello:** l'ordine viene rifiutato indicando quali piatti non sono più disponibili, nient'altro viene salvato → test in Task 5.
3. **Prezzo/poke manomessi dal client:** il server ignora qualunque prezzo inviato e rifiuta poke con scelte fuori regola o ingredienti inesistenti → test in Task 3 e Task 5.
4. **Indovinare il codice:** dopo 5 errori il dispositivo è bloccato per 10 minuti anche con il codice giusto → test in Task 4.
5. **Due tavoli aperti nello stesso istante:** mai due sessioni aperte con lo stesso codice né due sessioni aperte sullo stesso tavolo (indici unici parziali + retry) → test in Task 2.

---

## File Structure

```
supabase/migrations/20261012120000_tavoli_e_ordini.sql   tavoli, sessioni, tentativi, ordini, righe
src/domain/
  codice-tavolo.ts (+test)        genera/valida codici a 4 cifre
  stati-tavolo.ts (+test)         transizioni stato ordine al tavolo
  poke.ts (+test)                 validazione scelte e prezzo della poke composta
  carrello.ts (+test)             tipi e validazione del carrello inviato dal client
  limiti-tentativi.ts (+test)     decisione blocco tentativi
src/tavoli/
  repo.ts (+test)                 tavoli e sessioni (apri, chiudi, verifica codice, tentativi)
  ordini-repo.ts (+test)          crea ordine, leggi ordini, cambia stato, annulla riga, riepilogo conto
  poke-repo.ts (+test)            leggi/salva poke_config
  cookie.ts                       nome/opzioni del cookie di sessione tavolo
src/app/tavolo/[slug]/
  page.tsx, azioni.ts (+test), ModuloCodice.tsx, MenuOrdinabile.tsx, Carrello.tsx,
  ComponiPoke.tsx, OrdinatoFinora.tsx, tavolo.css
src/app/staff/
  page.tsx (sostituisce il segnaposto), azioni.ts (+test), SchermoStaff.tsx,
  InizioTurno.tsx, staff.css, conto/[sessione]/page.tsx
src/app/admin/tavoli/ page.tsx, azioni.ts (+test), stampa/page.tsx
src/app/admin/poke/  page.tsx, azioni.ts (+test), ModuloPoke.tsx
src/componenti/AggiornamentoAutomatico.tsx   refresh periodico condiviso
```

---

### Task 1: Dominio puro — codice, stati, limiti

**Files:** Create `src/domain/codice-tavolo.ts`, `src/domain/stati-tavolo.ts`, `src/domain/limiti-tentativi.ts` e i rispettivi `*.test.ts`.

**Produces:**
```ts
// codice-tavolo.ts
export function generaCodice(rand?: (max: number) => number): string   // default crypto.randomInt; sempre 4 cifre con zeri iniziali
export function normalizzaCodice(input: string): string | null         // toglie spazi; accetta solo /^\d{4}$/ → stringa, altrimenti null
// stati-tavolo.ts
export type StatoOrdineTavolo = 'inviato' | 'in_preparazione' | 'servito' | 'annullato'
export const STATI_TAVOLO: readonly StatoOrdineTavolo[]
export function prossimoStato(s: StatoOrdineTavolo): StatoOrdineTavolo | null  // inviato→in_preparazione→servito→null; annullato→null
export function puoAnnullare(s: StatoOrdineTavolo): boolean                    // true solo per inviato e in_preparazione
export function etichettaStato(s: StatoOrdineTavolo): string                   // «Inviato», «In preparazione», «Servito», «Annullato»
// limiti-tentativi.ts
export const LIMITE_DISPOSITIVO = 5, LIMITE_TAVOLO = 30, FINESTRA_MINUTI = 10
export function bloccato(erroriDispositivo: number, erroriTavolo: number): boolean  // >= limite su uno dei due
```

- [ ] Test (fallire prima): con `rand` che restituisce in sequenza `0, 0, 4, 2` (una cifra per chiamata, `rand(10)`) → `'0042'`; 1000 chiamate reali tutte `/^\d{4}$/`. `normalizzaCodice(' 12 34 ')` → `'1234'`; `'123'`, `'12345'`, `'abcd'`, `''` → `null`. Transizioni e `puoAnnullare` per ogni stato; `bloccato(4, 29)` false, `bloccato(5,0)` true, `bloccato(0,30)` true.
- [ ] Implementa, test verdi, commit.

### Task 2: Migrazione tavoli, sessioni, tentativi, ordini + repo tavoli

**Files:** Create `supabase/migrations/20261012120000_tavoli_e_ordini.sql`, `src/tavoli/repo.ts`, `src/tavoli/repo.test.ts`. Modify `tests/db/schema.test.ts` solo se servono righe in `auth.users` (non dovrebbe).

**Migrazione (contenuto richiesto):**
```sql
create table public.tavoli (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  posizione int not null default 0,
  attivo boolean not null default true
);
create table public.sessioni_tavolo (
  id uuid primary key default gen_random_uuid(),
  tavolo_id uuid not null references public.tavoli (id) on delete restrict,
  codice char(4) not null check (codice ~ '^[0-9]{4}$'),
  aperta_il timestamptz not null default now(),
  chiusa_il timestamptz
);
create unique index sessioni_una_aperta_per_tavolo on public.sessioni_tavolo (tavolo_id) where chiusa_il is null;
create unique index sessioni_codice_unico_tra_aperte on public.sessioni_tavolo (codice) where chiusa_il is null;
create table public.tentativi_codice (
  id bigint generated always as identity primary key,
  tavolo_id uuid not null references public.tavoli (id) on delete cascade,
  dispositivo uuid not null,
  creato_il timestamptz not null default now()
);
create index tentativi_tavolo_tempo on public.tentativi_codice (tavolo_id, creato_il);
create table public.ordini (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity unique,
  tipo text not null default 'tavolo' check (tipo in ('tavolo')),   -- la tappa 3 estende il check
  stato text not null default 'inviato' check (stato in ('inviato', 'in_preparazione', 'servito', 'annullato')),
  sessione_id uuid references public.sessioni_tavolo (id) on delete restrict,
  totale_cent int not null check (totale_cent >= 0),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (tipo <> 'tavolo' or sessione_id is not null)
);
create index ordini_stato_creato on public.ordini (stato, creato_il);
create index ordini_sessione on public.ordini (sessione_id);
create table public.righe_ordine (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini (id) on delete cascade,
  piatto_id uuid references public.piatti (id) on delete set null,
  numero int,
  nome text not null,
  prezzo_unit_cent int not null check (prezzo_unit_cent >= 0),
  quantita int not null check (quantita between 1 and 20),
  nota text check (nota is null or length(nota) <= 200),
  poke jsonb,
  annullata boolean not null default false,
  posizione int not null
);
create index righe_ordine_ordine on public.righe_ordine (ordine_id, posizione);
-- RLS + revoke su tutte e cinque le tabelle, come nella tappa 1
alter table public.tavoli enable row level security;
alter table public.sessioni_tavolo enable row level security;
alter table public.tentativi_codice enable row level security;
alter table public.ordini enable row level security;
alter table public.righe_ordine enable row level security;
revoke all on public.tavoli, public.sessioni_tavolo, public.tentativi_codice, public.ordini, public.righe_ordine from anon, authenticated;
```
(Una riga «poke composta» ha `piatto_id null`, `nome 'Poke composta'`, `poke` = scelte; le righe normali hanno `poke null`.)

**Produces (`src/tavoli/repo.ts`):**
```ts
export interface Tavolo { id: string; nome: string; slug: string; posizione: number; attivo: boolean }
export interface SessioneAperta { id: string; tavoloId: string; codice: string; apertaIl: Date }
export interface TavoloConSessione extends Tavolo { sessione: SessioneAperta | null }
export async function elencoTavoli(db: Db): Promise<TavoloConSessione[]>                 // ordinati per posizione, nome
export async function tavoloDaSlug(db: Db, slug: string): Promise<Tavolo | null>          // solo attivi; slug non valido → null
export async function creaTavolo(db: Db, nome: string, slug: string): Promise<Tavolo>
export async function aggiornaTavolo(db: Db, id: string, d: { nome: string; attivo: boolean; posizione: number }): Promise<Tavolo | null>
export async function apriSessione(db: Db, tavoloId: string, genera?: () => string): Promise<SessioneAperta>
   // se il tavolo ha già una sessione aperta la restituisce; altrimenti inserisce con codice nuovo,
   // ritentando fino a 10 volte se viola l'indice sul codice (SQLSTATE 23505 su sessioni_codice_unico_tra_aperte)
export async function chiudiSessione(db: Db, sessioneId: string): Promise<boolean>        // set chiusa_il=now() solo se aperta
export async function sessioneApertaPerId(db: Db, sessioneId: string): Promise<(SessioneAperta & { tavoloSlug: string }) | null>
export async function registraTentativoFallito(db: Db, tavoloId: string, dispositivo: string): Promise<void>
export async function contaErrori(db: Db, tavoloId: string, dispositivo: string, minuti: number): Promise<{ dispositivo: number; tavolo: number }>
export async function verificaCodice(db: Db, tavoloId: string, codice: string): Promise<SessioneAperta | null>  // sessione aperta del tavolo con quel codice
```
- [ ] Test PGlite (fallire prima): crea tavolo; slug duplicato rifiutato; `apriSessione` due volte → stessa sessione; `genera` che restituisce sempre `'1234'` su due tavoli → il secondo ritenta: con `genera` sequenza `['1234','1234','5678']` il secondo tavolo ottiene `'5678'`; chiusa la prima sessione, `'1234'` torna disponibile; `verificaCodice` giusto/sbagliato/su tavolo chiuso; `contaErrori` conta solo gli ultimi N minuti (inserisci un tentativo con `creato_il = now() - interval '11 minutes'` via SQL); id/slug malformati → `null`/`false` senza eccezioni; una seconda sessione aperta sullo stesso tavolo via INSERT diretto viene rifiutata dall'indice.
- [ ] Implementa (UUID regex come `src/menu/repo.ts`; `count(*)::int`), test verdi, commit.

### Task 3: Poke composta — dominio, repo, admin

**Files:** Create `src/domain/poke.ts` (+test), `src/tavoli/poke-repo.ts` (+test), `src/app/admin/poke/page.tsx`, `azioni.ts` (+test), `ModuloPoke.tsx`. Modify `src/app/admin/layout.tsx` (link «Tavoli» e «Poke» accanto a «Menù»).

**Produces:**
```ts
// src/domain/poke.ts — usa GruppoPoke/PokeConfig di src/menu/importa.ts
export type SceltePoke = Record<string, string[]>          // nome gruppo → voci scelte
export type EsitoPoke = { ok: true; scelte: SceltePoke; prezzoCent: number } | { ok: false; errore: string }
export function pokeOrdinabile(c: PokeConfig): boolean     // prezzoBaseCent !== null && prezzoExtraCent !== null
export function validaPoke(c: PokeConfig, scelte: unknown): EsitoPoke
   // scelte deve essere un oggetto; ogni gruppo esistente: array di stringhe senza doppioni, tutte presenti in g.voci,
   // lunghezza tra g.min e g.max; gruppi sconosciuti → errore; gruppo mancante = []
   // prezzo = base + extra × Σ max(0, scelti − g.inclusi); normalizza l'ordine delle voci come in g.voci
// src/tavoli/poke-repo.ts
export async function leggiPokeConfig(db: Db): Promise<PokeConfig | null>
export async function salvaPokeConfig(db: Db, c: PokeConfig): Promise<void>   // update della riga id=1
```
Messaggi: «Scegli almeno {min} in {gruppo}», «Al massimo {max} in {gruppo}», «Scelta non valida in {gruppo}», «La poke composta non è ancora disponibile».

- [ ] Test dominio: config di prova (Base 1/1/1, Proteine 1/3/2, Salse 0/3/2, base 900, extra 100): scelta minima valida → 900; 3 proteine → 1000; base mancante → errore min; voce inventata → errore; doppione → errore; gruppo sconosciuto → errore; `scelte` non oggetto / `null` / array → errore; config con prezzo null → `pokeOrdinabile` false.
- [ ] Test repo su PGlite con seed (`creaDbDiTest({ seed: true })`): legge 5 gruppi e prezzo null; salva prezzi e regole e rilegge.
- [ ] Admin `/admin/poke` (`richiediRuolo('admin')` in pagina e azione): per ogni gruppo campi numerici min/max/inclusi; campi prezzo base e prezzo extra (input testo, parsati con `parseEuro`); validazione: 0 ≤ min ≤ max ≤ numero voci, 0 ≤ inclusi ≤ max, prezzi obbligatori; il modulo conserva i valori dopo un errore (stesso schema `valori`/`invii` di `src/app/admin/menu/azioni.ts`); messaggio «Salvato.». Le voci dei gruppi in questa tappa non si modificano (si mostrano in sola lettura). Test delle azioni con mock come `src/app/admin/menu/azioni.test.ts`.
- [ ] Verifica, commit.

### Task 4: Accesso al tavolo con il codice

**Files:** Create `src/tavoli/cookie.ts`, `src/app/tavolo/[slug]/azioni.ts` (solo `entraAlTavolo` in questo task) + `azioni.test.ts`, `ModuloCodice.tsx`, `page.tsx` (prima versione: codice oppure «Sei al tavolo X» segnaposto), `tavolo.css`. Modify `src/proxy.ts` **non serve** (le pagine tavolo sono pubbliche; non aggiungerle al matcher).

**Comportamento:**
- Cookie dispositivo `ds_dispositivo` (UUID casuale, httpOnly, sameSite lax, secure in produzione, 1 anno) creato al primo accesso a `/tavolo/*`.
- Cookie sessione `ds_tavolo_<slug>` = id della sessione aperta, httpOnly, sameSite lax, secure in produzione, path `/tavolo/<slug>`, max-age 12 ore. Nomi e opzioni in `src/tavoli/cookie.ts` (`nomeCookieTavolo(slug)`, `OPZIONI_COOKIE`).
- `entraAlTavolo(slug, stato, fd)`: tavolo inesistente/inattivo → «Tavolo non trovato»; tavolo senza sessione aperta → «Il tavolo non è ancora aperto: chiedi al personale»; se `bloccato(contaErrori…)` → messaggio troppi tentativi (anche se il codice è giusto); codice non valido o sbagliato → registra tentativo, «Codice non corretto»; codice giusto → set cookie e `redirect` alla stessa pagina.
- `page.tsx` (server, `await connection()` non serve se leggi cookies/params): risolve tavolo da slug (404 se assente); se il cookie punta a una sessione aperta **dello stesso tavolo** mostra il menù ordinabile (Task 6); altrimenti `ModuloCodice` (input `inputMode="numeric"`, `autoComplete="one-time-code"`, maxLength 4, pattern `\d{4}`, testo «Inserisci il codice che ti ha dato il cameriere»). Cookie con sessione chiusa → mostra «Il tavolo è chiuso, grazie per essere stati da noi!» e il modulo del codice.
- Le pagine tavolo usano il layout radice e lo stile del sito (logo + nome del tavolo in alto), non il layout `(cliente)`.

- [ ] Test azioni (mock di repo/cookies/redirect): ogni ramo sopra; il blocco vince sul codice giusto; il redirect avviene solo col codice giusto; codice `' 12 34 '` normalizzato.
- [ ] Verifica, commit.

### Task 5: Ordini — repo e invio dal tavolo

**Files:** Create `src/domain/carrello.ts` (+test), `src/tavoli/ordini-repo.ts` (+test). Modify `src/app/tavolo/[slug]/azioni.ts` (+ `inviaOrdine`, `leggiOrdinatoFinora`) e il suo test.

**Produces:**
```ts
// src/domain/carrello.ts
export interface RigaCarrello { piattoId: string | null; quantita: number; nota: string; poke?: SceltePoke }  // piattoId null ⇔ poke composta
export function validaCarrello(input: unknown): { ok: true; righe: RigaCarrello[] } | { ok: false; errore: string }
   // array 1..40; quantita intero 1..20; nota stringa ≤200 (trim, '' → ''); piattoId UUID o null; se null serve poke oggetto
// src/tavoli/ordini-repo.ts
export interface RigaOrdine { id: string; numero: number | null; nome: string; prezzoUnitCent: number; quantita: number; nota: string | null; poke: SceltePoke | null; annullata: boolean }
export interface Ordine { id: string; numero: number; stato: StatoOrdineTavolo; totaleCent: number; creatoIl: Date; sessioneId: string; tavoloNome: string; righe: RigaOrdine[] }
export type EsitoCreazione = { ok: true; ordine: Ordine } | { ok: false; errore: string; nonDisponibili?: string[] }
export async function creaOrdineTavolo(db: Db, sessioneId: string, righe: RigaCarrello[]): Promise<EsitoCreazione>
   // IN UNA TRANSAZIONE (`begin`/`commit` con `select … for update` sulla sessione; vedi nota sotto):
   // 1) sessione aperta? altrimenti «Il tavolo è stato chiuso: chiedi al personale»
   // 2) legge i piatti richiesti; inesistenti o non disponibili → errore «Alcuni piatti non sono più disponibili» + nomi
   // 3) poke: legge poke_config; non ordinabile → errore; validaPoke per ogni riga poke
   // 4) prezzi SOLO dal DB; righe con copia di numero/nome/prezzo; totale = Σ prezzo × quantità
   // 5) inserisce ordine + righe; restituisce l'ordine completo
export async function ordiniDellaSessione(db: Db, sessioneId: string): Promise<Ordine[]>       // dal più vecchio
export async function ordiniAttivi(db: Db): Promise<Ordine[]>                                 // stato inviato/in_preparazione di sessioni aperte, dal più vecchio
export async function avanzaStato(db: Db, ordineId: string): Promise<Ordine | null>           // usa prossimoStato; null se finale/inesistente
export async function annullaOrdine(db: Db, ordineId: string): Promise<boolean>              // solo se puoAnnullare
export async function annullaRiga(db: Db, rigaId: string): Promise<boolean>                  // annullata=true, ricalcola totale_cent dell'ordine
export interface Conto { tavoloNome: string; apertaIl: Date; chiusaIl: Date | null; voci: { nome: string; numero: number | null; quantita: number; importoCent: number }[]; totaleCent: number }
export async function contoSessione(db: Db, sessioneId: string): Promise<Conto | null>
   // righe non annullate di ordini non annullati, raggruppate per (numero, nome, prezzo, poke) con quantità sommate
```
**Nota transazioni:** l'interfaccia `Db` non espone transazioni. Aggiungi a `src/server/db-tipi.ts` un metodo opzionale-obbligatorio `transazione<T>(fn: (tx: Db) => Promise<T>): Promise<T>`; in `src/server/db.ts` implementalo con `sql.begin(tx => fn({ query: (t, p) => tx.unsafe(t, p) …, transazione: … }))`; in `tests/db/pglite.ts` con `pg.transaction(tx => …)`. Aggiorna tutti i fake `Db` dei test esistenti (cerca `query:` nei test e negli script, es. `scripts/assegna-ruolo.ts`) perché il tipo resti soddisfatto.

`inviaOrdine(slug, carrelloJson: string)`: legge cookie → sessione aperta dello stesso tavolo (altrimenti errore tavolo chiuso); `JSON.parse` protetto; `validaCarrello`; `creaOrdineTavolo`; restituisce `{ ok, errore?, nonDisponibili?, numero? }`. `leggiOrdinatoFinora(slug)`: ordini della sessione del cookie (o `[]`).

- [ ] Test carrello (input malformati di ogni tipo). Test repo PGlite con seed + un tavolo e una sessione: ordine valido (totale corretto, copie di nome/prezzo); **prezzo nel carrello ignorato** (il tipo non lo prevede: verifica che un campo `prezzoCent` extra nel JSON non cambi nulla); piatto esaurito → nessun ordine creato, `nonDisponibili` con il nome; sessione chiusa → errore e nessun ordine; poke con prezzo null → errore; poke valida → riga «Poke composta» con prezzo calcolato; `annullaRiga` ricalcola il totale; `avanzaStato` fino a `servito` poi `null`; `contoSessione` raggruppa due ordini con lo stesso piatto ed esclude righe/ordini annullati.
- [ ] Test azione `inviaOrdine` con mock (cookie mancante, JSON rotto, carrello non valido, esito ok).
- [ ] Verifica, commit.

### Task 6: Pagina tavolo — menù ordinabile, carrello, poke, ordinato finora

**Files:** Create `MenuOrdinabile.tsx`, `Carrello.tsx`, `ComponiPoke.tsx`, `OrdinatoFinora.tsx` in `src/app/tavolo/[slug]/`, `src/componenti/AggiornamentoAutomatico.tsx`. Modify `page.tsx`, `tavolo.css`.

**Comportamento:**
- `page.tsx` (sessione valida): carica `leggiMenu(db)`, `leggiPokeConfig(db)`, `ordiniDellaSessione` e passa a componenti client **solo dati semplici** (niente Date: converti in stringhe ISO).
- `MenuOrdinabile` (client): stessa struttura e classi del menù pubblico (`menu-cat`, `dishes`, `dish*`, chip `ds-cats` con ancore), con per ogni piatto disponibile un bottone «Aggiungi» (secondario) e, se nel carrello, controlli − / quantità / +; piatti esauriti con badge «Esaurito» e senza bottone. Mostra **sempre** la frase allergeni con `testoAllergeni` (`src/menu/testo-allergeni.ts`). Se `pokeOrdinabile`, nella categoria `poke-bowl` una card «Componi la tua poke» che apre `ComponiPoke`.
- `ComponiPoke`: un fieldset per gruppo (checkbox per max>1, radio per max=1), contatore «2 di 3 (2 incluse)», prezzo aggiornato in tempo reale con la stessa `validaPoke` del server, bottone «Aggiungi al carrello» abilitato solo se valida.
- `Carrello` (client): barra fissa in basso con «Carrello · N piatti · totale stimato» che apre un pannello (dialog accessibile: focus, Esc, chiusura) con righe, nota per riga («Note per la cucina, es. senza sesamo», max 200), e **l'unico bottone pieno della schermata** «Invia ordine». Il totale mostrato è indicativo; dopo l'invio mostra «Ordine n. {numero} inviato in cucina» e svuota il carrello; in caso di errore mostra il messaggio e, con `nonDisponibili`, rimuove quei piatti dal carrello e li elenca. Doppio tocco protetto (bottone disabilitato durante l'invio).
- Il carrello si salva in `sessionStorage` con chiave `carrello_<sessioneId>` (try/catch; se non disponibile si lavora in memoria) così un ricaricamento non lo perde; cambiando sessione si azzera.
- `OrdinatoFinora`: elenco ordini del tavolo (numero, ora, stato con `etichettaStato`, righe, note; righe annullate barrate con «annullato») e «Totale finora» (somma ordini non annullati). Più telefoni sullo stesso tavolo vedono gli stessi ordini.
- `AggiornamentoAutomatico({ ogniSecondi })` (client, riusato dallo staff): `router.refresh()` con `setInterval`; si ferma con `document.visibilityState === 'hidden'` e riparte (refresh immediato) al ritorno; se `navigator.onLine` è false mostra un avviso «Connessione assente: i dati potrebbero non essere aggiornati» (role="status").
- Se durante il refresh la sessione risulta chiusa, la pagina mostra «Il tavolo è chiuso, grazie per essere stati da noi!» e il carrello non è più inviabile.
- 375 px: barra carrello e pannello senza scroll orizzontale; target touch ≥ 44 px.

- [ ] Typecheck/build; test di render (`renderToStaticMarkup`) di `OrdinatoFinora` (stati, riga annullata barrata, totale) e della card piatto esaurito senza bottone «Aggiungi».
- [ ] Verifica, commit.

### Task 7: Schermo staff

**Files:** Modify `src/app/staff/page.tsx` (sostituisce il segnaposto), `src/app/staff/staff.css`. Create `src/app/staff/azioni.ts` (+test), `SchermoStaff.tsx`, `InizioTurno.tsx`, `src/app/staff/conto/[sessione]/page.tsx`.

**Comportamento:**
- `page.tsx`: `richiediRuolo('staff')`; carica `elencoTavoli` e `ordiniAttivi`; `AggiornamentoAutomatico ogniSecondi={5}`; intestazione «Area staff» con «Esci» (secondario).
- **InizioTurno** (client): finché non si tocca «Inizia turno» mostra solo quel bottone e una riga di spiegazione («Attiva suono e schermo sempre acceso»). Il tocco sblocca l'audio (crea `AudioContext` e suona un bip breve) e chiede `navigator.wakeLock.request('screen')` (se disponibile; riacquisito su `visibilitychange`). Lo stato «turno iniziato» vive in `sessionStorage`.
- **Sezione Cucina:** colonne «Inviati» e «In preparazione» (a 375 px diventano una sotto l'altra), ordini dal più vecchio; card con tavolo, n. ordine, minuti trascorsi, righe con quantità, **note e scelte poke evidenziate** (bordo arancio, testo inchiostro), righe annullate barrate. Bottoni: «In preparazione» / «Servito» (avanza stato), «Annulla ordine» e «Annulla» per riga con conferma (`confirm()` va bene) — secondari. Un nuovo ordine (id mai visto prima nel client) fa suonare un bip ripetuto 3 volte ed evidenzia la card finché non viene toccata o avanzata.
- **Sezione Tavoli:** griglia di tavoli. Chiuso → bottone «Apri tavolo». Aperto → codice **grande** (`.display`), ora di apertura, numero ordini e totale finora, bottoni «Conto» (link alla pagina conto) e «Chiudi tavolo» (con conferma «Chiudere il tavolo X? I clienti non potranno più ordinare.»). Dopo «Apri tavolo» il codice compare subito.
- **Conto** `/staff/conto/[sessione]`: `richiediRuolo('staff')`; `contoSessione` (404 se id non valido); tabella voci (n., piatto, quantità, importo) e totale grande; nota «Da battere in cassa: questo non è uno scontrino fiscale.»; link «Torna allo schermo»; stampabile (`@media print` nasconde la navigazione).
- **Azioni** (`'use server'`, `richiediRuolo('staff')` per prima): `apriTavolo(tavoloId)`, `chiudiTavolo(sessioneId)`, `avanzaOrdine(ordineId)`, `annullaOrdineStaff(ordineId)`, `annullaRigaStaff(rigaId)`. Validano gli id; errori DB catturati (solo attorno al DB) con messaggio «Operazione non riuscita, riprova.» restituito al client; `revalidatePath('/staff')` dopo ogni modifica.

- [ ] Test azioni con mock (ruolo chiamato prima di tutto e i suoi errori propagati; id non validi rifiutati senza toccare il repo; errore DB → messaggio).
- [ ] Test render di una card ordine (nota e poke visibili, riga annullata barrata).
- [ ] Verifica, commit.

### Task 8: Admin tavoli e stampa dei QR

**Files:** Create `src/app/admin/tavoli/page.tsx`, `azioni.ts` (+test), `stampa/page.tsx`. Install `npm i --save-exact qrcode@1.5.4 && npm i -D --save-exact @types/qrcode@1.5.6`.

**Comportamento:**
- `/admin/tavoli` (`richiediRuolo('admin')`): elenco tavoli con nome, slug, attivo, posizione; modulo «Aggiungi tavolo» (nome; slug generato dal nome: minuscole, accenti tolti, spazi → `-`, solo `[a-z0-9-]`, univoco aggiungendo `-2`, `-3`; funzione pura `slugDaNome` con test); modifica nome/posizione/attivo. Un tavolo con sessione aperta non si disattiva («Chiudi prima il tavolo dallo schermo staff»).
- `/admin/tavoli/stampa`: una card per tavolo attivo con nome grande, QR (SVG generato lato server con `QRCode.toString(url, { type: 'svg', margin: 1 })`) dell'URL assoluto `https://<host>/tavolo/<slug>` e la scritta «Inquadra per ordinare · il codice te lo dà il cameriere». Host: variabile opzionale `APP_URL` (documentala in `.env.example` e README); se manca, ricava origin da `headers()` (`x-forwarded-proto` + `host`). Layout di stampa A4, 4 card per pagina, `@media print` senza barra admin.
- [ ] Test `slugDaNome` e azioni (ruolo admin, validazioni: nome 1–40 caratteri).
- [ ] Verifica, commit.

### Task 9: Rifiniture trasversali

- [ ] `src/app/admin/layout.tsx`: link «Tavoli», «Poke», «Schermo staff».
- [ ] `src/app/staff` e `src/app/tavolo/[slug]`: `error.tsx` in italiano (come `src/app/admin/error.tsx`, con `retry`).
- [ ] README: sezioni «Tavoli e QR», «Schermo staff», «Ordini al tavolo», variabile `APP_URL`.
- [ ] `docs/superpowers/specs/…`: nessuna modifica, salvo correggere §7 se qualcosa è cambiato (annotalo).
- [ ] Verifica completa, commit.

### Task 10: Applicare la migrazione e prova nel browser

Il progetto Supabase è `daniel-sushi` (ref `rxsywhdznaugfhmsdjsa`) nell'organizzazione free «daniel sushi». **Chiedi all'utente** prima di applicare la migrazione al database reale. Applicala con lo strumento che hai (MCP Supabase `apply_migration`, oppure uno script locale che esegue il file con `DATABASE_URL` da `.env.local` tramite `postgres` senza stamparla). Poi controlla gli advisor di sicurezza: è atteso solo «RLS enabled, no policy».

Prova nel browser con `npm run dev` (l'utente fa il login da sé: **non inserire mai la sua password**; per lo staff può creare un secondo utente e assegnare `npm run ruolo -- <email> staff`):
1. Admin: crea i tavoli «Tavolo 1» e «Tavolo 2», imposta regole e prezzo poke (es. base 9,00 €, extra 1,00 €), apri la pagina di stampa: due QR leggibili (scansionali col telefono o verifica l'URL nel SVG).
2. Staff (anche come admin): «Inizia turno», «Apri tavolo» su Tavolo 1 → codice grande.
3. Seconda scheda come cliente (finestra in incognito, o `tabs_create` del browser integrato senza cookie di login): `/tavolo/tavolo-1` → codice sbagliato → «Codice non corretto»; codice giusto → menù.
4. Aggiungi 2 piatti con una nota e una poke composta, invia → «Ordine n. X inviato»; entro 5 s lo schermo staff mostra l'ordine con nota e poke e suona.
5. Terza scheda come secondo telefono sullo stesso tavolo: vede l'ordine nell'«ordinato finora».
6. Staff: «In preparazione», poi annulla una riga, poi «Servito»: il cliente lo vede entro 10 s; il totale scende.
7. Admin: segna esaurito un piatto presente nel carrello di un cliente, il cliente invia → messaggio con il nome del piatto, nessun ordine creato.
8. Staff: «Conto» → voci raggruppate e totale corretti; «Chiudi tavolo» → il cliente vede «Il tavolo è chiuso…» e non può inviare; riaprendo il tavolo il codice è nuovo.
9. 6 codici sbagliati di fila dallo stesso dispositivo → blocco anche col codice giusto.
10. Tutte le pagine a 375 px: niente scroll orizzontale; CSS caricato (`getComputedStyle(document.body).backgroundColor` = `rgb(251, 249, 246)`).
11. Pulisci i dati di prova (ordini, sessioni, tentativi) **chiedendo prima all'utente**; i tavoli possono restare.

### Task 11: Revisione finale e consegna

- [ ] Rileggi tutto il diff del branch contro la spec (§4.2, §4.3, §5) e la Review Focus di questo piano; correggi ciò che manca.
- [ ] `npm test && npm run typecheck && npm run lint && npm run build` verdi senza flag.
- [ ] Push del branch `tappa-2-tavolo` e PR verso il branch base, in italiano: cosa contiene, verifiche fatte nel browser, cosa resta (tappa 3: domicilio e asporto), decisioni prese rispetto al piano.
