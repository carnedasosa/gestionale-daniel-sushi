# Tappa 3 — Domicilio e asporto — Implementation Plan

> **Per chi esegue (Codex o altro agente):** esegui questo piano task per task, **nell'ordine**, spuntando le checkbox `- [ ]`. Il codice di questo piano **è già stato scritto e verificato** su un branch di prova partito da `9759d70`, cioè da questo stesso branch prima del piano. Verifiche fatte:
> - per ogni task: `tsc`, `eslint` e i test toccati dal task;
> - alla fine: suite completa 61 file / 283 test, `next build` senza `.env.local`;
> - prova nel browser su un Postgres locale con tutte le migrazioni e il seed.
>
> I blocchi «Crea», «Sostituisci tutto il contenuto», «Modifica… sostituisci… con…» e «Sposta» sono generati direttamente da quei commit. Il tuo compito è **riportarli fedelmente**, eseguire i test e fare i commit. Leggi prima la sezione «Regole di esecuzione»: valgono più di qualunque tua preferenza.

**Goal:** ordini da casa (asporto e domicilio) senza telefonate:
- menù ordinabile, checkout con fasce di 15 minuti, accettazione dal tablet con suono, pagina dello stato, email;
- configurazione di zone, orari e chiusure da parte dell'admin;
- bottoni «Ordina» del sito collegati all'app.

**Architecture:**
- La tabella `ordini` si estende ai tipi `asporto` e `domicilio`, con nuove tabelle per zone, orari, chiusure, impostazioni e coda delle email (una migrazione additiva).
- La logica sta in moduli puri (`src/domain/`) e repository (`src/casa/`).
- Il cliente usa carrello, card e composer della tappa 2, spostati in `src/ordinare/`.
- L'invio da casa si mette in fila sul lock della riga delle impostazioni, così la capacità delle fasce è garantita.
- Le email passano da una coda nel DB e partono con `after()` verso l'API HTTP di Resend.
- L'anonimizzazione a 12 mesi è una route chiamata ogni giorno dal cron di Vercel.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, `pg` 8.23.0, Vitest 5 con PGlite 0.5.8, TypeScript. Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md`, da leggere tutta prima di iniziare. Spec generale: `docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`.

---

## Regole di esecuzione (non negoziabili)

1. **Fai solo quello che c'è scritto.** Niente refactoring, rinomini, riformattazioni, aggiornamenti di dipendenze, cambi di stile o «migliorie» non richieste. Se un file non è nominato in un task, non lo tocchi.
2. **Il codice va copiato com'è**, compresi commenti, nomi e virgole senza spazio. Lo stile del repo è compatto (`a,b` invece di `a, b`): non «sistemarlo».
3. **Le modifiche sono «sostituisci questo blocco con quest'altro».**
   - Il blocco «prima» deve comparire **identico e una volta sola** nel file. Su Windows i file possono avere fine riga CRLF: la differenza CRLF/LF non conta, tutto il resto sì.
   - Se il blocco non si trova, o si trova più volte, **fermati** e scrivi all'utente file e blocco. Non adattare a intuito.
   - Più modifiche sullo stesso file («1 di 3», «2 di 3»…) vanno applicate nell'ordine scritto.
4. **«Sposta»** si fa con il `git mv` indicato, poi si applicano le modifiche al file spostato. **«Sostituisci tutto il contenuto»** riscrive il file per intero con il blocco dato.
5. **Se un test non passa come previsto, fermati** e riporta l'output.
   - Non cambiare il test per farlo passare e non cambiare l'implementazione in modo diverso da quanto scritto.
   - Al massimo un tentativo di correggere un tuo errore di copia; poi fermati.
   - Un timeout isolato di PGlite con la macchina carica (`Test timed out` nel `beforeEach`) non è un errore del codice: rilancia una volta. Se si ripete, fermati.
6. **Database reale:** nessuna scrittura, migrazione o pulizia sul Supabase reale senza il «sì» esplicito dell'utente in chat. Senza chiedere puoi fare solo le operazioni marcate **(sola lettura)**. Non stampare mai il contenuto di `.env.local` né la `DATABASE_URL`.
7. **Non inserire mai password dell'utente.** Per il login nel browser chiedi all'utente di farlo lui.
8. **Branch:** lavori su `tappa-3-casa`, che contiene già spec e piano, e alla fine apri la PR verso `main`. Per il sito (Task 13) lavori su un branch nuovo del repo `daniel-sushi`. **Non fare merge** e non toccare `main` di nessuno dei due repo.
9. **Design system «Cupertino»** (`src/styles/ds/cupertino.css`): solo token e classi esistenti più quelle nuove che il piano crea (prefissi `casa-`, `staff-`, `admin-`). Niente colori, font, ombre o raggi nuovi.
10. **Commit piccoli in italiano**, uno per task, con il messaggio indicato. Niente `--no-verify`, niente `git push --force`. Non aggiungere righe `Co-Authored-By` di Claude: usa l'attribuzione del tuo strumento o nessuna.
11. Questo è **Next.js 16**: se devi capire un'API, leggi `node_modules/next/dist/docs/` (vedi `AGENTS.md`), non la memoria.
12. **Non avviare il server di sviluppo durante i Task 0–12**: i tipi che genera in `.next/types` possono citare pagine di task successivi e far fallire `tsc`. Se `npm run typecheck` segnala errori solo dentro `.next/types`, cancella `.next/types` e `.next/dev/types` e rilancia.

## Global Constraints

- **Dipendenze:** nessuna nuova; versioni invariate (`next` 16.4.0, `react` 19.3.0, `pg` 8.23.0, `@electric-sql/pglite` 0.5.8, `vitest` 5.0.3).
- **Migrazioni:** una sola nuova, `supabase/migrations/20261013120000_domicilio_asporto.sql`; quelle esistenti non si toccano.
- **Fuso orario:** date e ore del locale si calcolano sempre con `src/domain/ora-roma.ts` (`Europe/Rome`). Mai `getHours()`, né `toLocale…String` senza `timeZone: 'Europe/Rome'`. Nel DB, `date` si legge come testo (`::text`) e `time` come `HH:MI` (`to_char`).
- **Accesso ai dati:** il browser non tocca mai il DB. Le tabelle nuove hanno RLS attiva, privilegi revocati ad `anon`/`authenticated` e nessuna policy.
- **Prezzi:** sempre in centesimi interi, ricalcolati sul server. Se il totale non coincide con quello mostrato al cliente, l'ordine non parte.
- **Variabili nuove** (solo server, tutte facoltative): `RESEND_API_KEY`, `EMAIL_MITTENTE`, `CRON_SECRET`, `ORDINI_CASA_PROVA`. Quest'ultima vale solo con `NODE_ENV !== 'production'`.
- **Componenti client:** un file `'use client'` può esportare verso i Server Components **solo componenti e tipi**, mai array, oggetti o funzioni normali. Nel Server Component arriverebbe un riferimento client e la pagina andrebbe in errore: né i test né la build se ne accorgono.
- **Azioni server:** ogni azione staff/admin chiama `richiediRuolo('staff'|'admin')` come prima istruzione, fuori dai `try/catch`.
- **Altro:** `cacheComponents` resta disabilitato. Interfaccia in italiano, un solo bottone pieno (`ds-btn--primary`) per schermata, tutto usabile a 375 px senza scroll orizzontale.

## Review Focus

Casi che i test automatici non coprono e che un revisore (o la prova del Task 14) deve guardare:

1. **Due clienti sull'ultimo posto di una fascia, su Postgres vero.** PGlite serializza le transazioni, quindi i test non provano la concorrenza. La garanzia è il `select … for update` su `impostazioni_casa` in `creaOrdineCasa`, prima di `leggiDisponibilita`: deve restare lì.
2. **Valori esportati da file `'use client'` dentro pagine server.** Durante la verifica di questo piano la pagina `/admin/domicilio` andava in errore per questo motivo, con test e build verdi; la lista `GIORNI` ora sta in `src/domain/valida-domicilio.ts`. Nel Task 14 apri **tutte** le pagine nuove nel browser.
3. **Browser senza `localStorage`** (es. Safari in navigazione privata). Il carrello funziona in memoria, ma una nuova scheda di `/ordina` lo vede vuoto. È accettato: deve solo non dare errori.
4. **Resend vero con dominio non verificato.** Risponde 403: l'errore va in `email_ordini.ultimo_errore`, l'ordine e lo staff non si bloccano, e dopo 5 tentativi l'email non si ritenta più.
5. **Tablet staff lasciato acceso a mezzanotte.** L'interruttore vale per la data di Roma in cui è stato acceso: il giorno dopo gli ordini risultano chiusi senza che nessuno tocchi nulla (test unitario in `apertura-casa`; nel browser basta controllare la scritta il giorno dopo).

## Stato verificato (12/10/2026)

- **Branch:** `tappa-3-casa` = `main` (`9013b1c`) + spec della tappa 3 + questo piano.
- **Suite di partenza:** 41 file, 192 test. Dopo questo piano: 61 file, 283 test.
- **DB reale (sola lettura):**
  - migrazioni registrate: `20261011163506 menu_e_ruoli`, `20261012120000 tavoli_e_ordini`, `20261012180000 correzioni_tavolo`;
  - 139 piatti, **0 con allergeni confermati**, 3 ordini di prova da tavolo, nessuna sessione aperta, prezzi della poke `null`, un solo profilo (admin);
  - nomi dei vincoli da sostituire: `ordini_tipo_check`, `ordini_stato_check`, `ordini_check`;
  - cronologia delle migrazioni: `supabase_migrations.schema_migrations(version text, statements text[], name text, created_by text, idempotency_key text, rollback text[])`.
- **Prova nel browser** (su Postgres locale con migrazioni e seed, `ORDINI_CASA_PROVA=1`):
  - blocco allergeni e interruttore spento;
  - carrello salvato e ripristinato;
  - minimo della zona;
  - errori dei campi;
  - prezzo cambiato durante il checkout, con riepilogo aggiornato;
  - ordine asporto accettato +15' fino a «Ritirato»;
  - ordine a domicilio rifiutato con motivo «Altro»;
  - pagina dello stato e link «Hai un ordine in corso»;
  - tavolo ancora funzionante dopo lo spostamento dei componenti;
  - admin (impostazioni, zone, orari, chiusure, allergeni poke) e allergeni nel composer;
  - 375 px senza scroll orizzontale.

## Mappa dei file

- **Dominio puro** (`src/domain/`):
  - `ora-roma` (data e ora di Roma ↔ istanti);
  - `fasce` (fasce di 15', prenotabilità);
  - `stati-casa` (passaggi, testi, colonne cucina, motivi di rifiuto);
  - `checkout` (controllo dei dati, telefono, email, totali);
  - `apertura-casa` (motivi di chiusura);
  - `allergeni-poke`;
  - `valida-domicilio` (moduli admin, nomi dei giorni);
  - `email-ordini` (testi delle email).
- **Repository e servizi** (`src/casa/`):
  - `impostazioni-repo`, `disponibilita`, `ordini-casa-repo`;
  - `email-repo`, `coda-email`, `resend`, `avvia-email`;
  - `cron`.
- **Condivisi tavolo/casa** (`src/ordinare/`): `CardPiatto`, `Carrello`, `ComponiPoke`, `SezioniMenu`, `useCarrelloSalvato`, `vista-carrello`, `archivio-casa`.
- **Pagine:**
  - cliente: `src/app/(cliente)/` (menù ordinabile, `ordina/`, `ordine/[token]/`, `privacy/`);
  - admin: `src/app/admin/domicilio/`, allergeni in `src/app/admin/poke/`;
  - staff: `src/app/staff/` (`OrdiniCasa.tsx`, `azioni-casa.ts`);
  - cron: `src/app/api/cron/anonimizza/`.
- **Modificati della tappa 2:**
  - `src/tavoli/ordini-repo.ts`: estrae `prezzaRighe`/`salvaRighe`, limita le azioni del tavolo a `tipo='tavolo'`, ricalcola il totale con la consegna;
  - `src/tavoli/poke-repo.ts`: allergeni degli ingredienti;
  - `src/app/tavolo/[chiave]/MenuOrdinabile.tsx`: usa i componenti condivisi.

---

### Task 0: Preparazione e tempi dei test

**File:** `vitest.config.mts`

- [x] **Step 1:** `git status` deve essere pulito. Poi `git checkout tappa-3-casa`. Se il branch è anche su GitHub, esegui `git pull`.
- [x] **Step 2:** `git log --oneline -3` deve mostrare in cima il commit del piano, poi `Spec della tappa 3: domicilio e asporto` (`9759d70`) e `9013b1c`. Se ci sono altri commit dell'utente che toccano file di questo piano, **fermati** e chiedi.
- [x] **Step 3:** `npm ci` e poi `npm test` → atteso **41 file, 192 test passati**. Se no, fermati.
- [x] **Step 4: tempi dei test.** Con una ventina di file PGlite in più, il seed nel `beforeEach` può superare i 30 secondi quando i file girano in parallelo.

**Sostituisci tutto il contenuto** di `vitest.config.mts` con:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' lancia un errore fuori dai Server Components: nei test va neutralizzato
      'server-only': fileURLToPath(new URL('./tests/stub-vuoto.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // I test con PGlite (~1,5 s a test, ~7 s a file) superano i 5 s di default quando i file girano in parallelo;
    // con una ventina di file PGlite insieme il seed nel beforeEach può superare anche i 30 s.
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
```


- [x] **Step 5: commit** — `git add vitest.config.mts && git commit -m "Test: 60 secondi per i file PGlite che girano in parallelo"`

---

### Task 1: Ora di Roma e fasce di 15 minuti

**File:** crea `src/domain/ora-roma.ts`, `src/domain/fasce.ts` e i loro test.

**Interfacce prodotte:**
- `partiRoma(d)`, `dataRoma(d): 'AAAA-MM-GG'`, `oraRoma(d): 'HH:MM'`;
- `dataValida(x)`, `giornoSettimana(data): 1..7`, `istanteRoma(data,minuti): Date`;
- `Servizio`, `SERVIZI`, `servizioValido`, `DURATA_FASCIA`, `Turno`, `RegoleFasce`, `Occupazione`;
- `minutiDa`, `fasceDelGiorno`, `fasciaPrenotabile`, `fascePrenotabili`.

- [x] **Step 1: test (prima del codice)**

**Crea** `src/domain/ora-roma.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { dataRoma, dataValida, giornoSettimana, istanteRoma, oraRoma } from './ora-roma'
it('data e ora di Roma anche quando in UTC è ancora il giorno prima', () => {
  expect(dataRoma(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13')
  expect(oraRoma(new Date('2026-10-12T22:30:00Z'))).toBe('00:30')
  expect(oraRoma(new Date('2026-12-01T18:05:00Z'))).toBe('19:05')
})
it('istante di un orario di Roma, d’estate, d’inverno e nei giorni del cambio d’ora', () => {
  expect(istanteRoma('2026-10-12',19 * 60).toISOString()).toBe('2026-10-12T17:00:00.000Z')
  expect(istanteRoma('2026-10-26',19 * 60).toISOString()).toBe('2026-10-26T18:00:00.000Z')
  expect(istanteRoma('2026-10-25',19 * 60 + 15).toISOString()).toBe('2026-10-25T18:15:00.000Z')
  expect(istanteRoma('2026-10-25',60).toISOString()).toBe('2026-10-24T23:00:00.000Z')
  expect(istanteRoma('2027-03-28',12 * 60).toISOString()).toBe('2027-03-28T10:00:00.000Z')
  expect(istanteRoma('2027-03-28',60).toISOString()).toBe('2027-03-28T00:00:00.000Z')
})
it('giorno della settimana da lunedì (1) a domenica (7) e date valide', () => {
  expect(giornoSettimana('2026-10-12')).toBe(1)
  expect(giornoSettimana('2026-10-18')).toBe(7)
  expect(dataValida('2026-10-12')).toBe(true)
  for (const d of ['2026-02-30','2026-13-01','12/10/2026','',null]) expect(dataValida(d)).toBe(false)
})
```


**Crea** `src/domain/fasce.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { fasceDelGiorno, fascePrenotabili, fasciaPrenotabile, minutiDa, servizioValido } from './fasce'
import { oraRoma } from './ora-roma'
const regole = { capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30 }
const ore = (fasce: Date[]) => fasce.map(oraRoma)
it('orari validi, anche nel formato del database', () => {
  expect(minutiDa('19:30')).toBe(1170); expect(minutiDa('19:30:00')).toBe(1170); expect(minutiDa('00:00')).toBe(0)
  for (const x of ['24:00','7:30','19:60','19:30:15','',null]) expect(minutiDa(x)).toBeNull()
  expect(servizioValido('domicilio')).toBe(true); expect(servizioValido('tavolo')).toBe(false)
})
it('fasce ogni 15 minuti, l’ultima prima della chiusura, turni sovrapposti fusi', () => {
  expect(ore(fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '20:00' }]))).toEqual(['19:00','19:15','19:30','19:45'])
  expect(ore(fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '19:40' },{ dalle: '19:30',alle: '20:00' },{ dalle: '12:00',alle: '12:20' }])))
    .toEqual(['12:00','12:15','19:00','19:15','19:30','19:45'])
  expect(fasceDelGiorno('2026-10-12',[{ dalle: 'x',alle: '20:00' }])).toEqual([])
})
it('nel giorno del cambio d’ora le fasce restano alle ore di Roma', () => {
  const fasce = fasceDelGiorno('2026-10-25',[{ dalle: '19:00',alle: '19:30' }])
  expect(fasce.map(f => f.toISOString())).toEqual(['2026-10-25T18:00:00.000Z','2026-10-25T18:15:00.000Z'])
})
it('prenotabile solo con l’anticipo minimo e sotto le due capacità', () => {
  const adesso = new Date('2026-10-12T16:40:00Z') // 18:40 a Roma
  const f = (ora: string) => new Date(`2026-10-12T${ora}:00+02:00`)
  expect(fasciaPrenotabile('asporto',f('19:00'),{ totale: 0,domicilio: 0 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 0,domicilio: 0 },regole,adesso)).toBe(true)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 2,domicilio: 0 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('asporto',f('19:15'),{ totale: 1,domicilio: 1 },regole,adesso)).toBe(true)
  expect(fasciaPrenotabile('domicilio',f('19:15'),{ totale: 1,domicilio: 1 },regole,adesso)).toBe(false)
  expect(fasciaPrenotabile('domicilio',f('19:15'),{ totale: 1,domicilio: 0 },{ ...regole,capacitaConsegne: 0 },adesso)).toBe(false)
})
it('elenco delle prenotabili con l’occupazione del database', () => {
  const fasce = fasceDelGiorno('2026-10-12',[{ dalle: '19:00',alle: '20:00' }])
  const occupazione = [{ fascia: '2026-10-12T17:15:00.000Z',totale: 1,domicilio: 1 },{ fascia: '2026-10-12T17:30:00.000Z',totale: 2,domicilio: 0 }]
  const adesso = new Date('2026-10-12T16:00:00Z')
  expect(ore(fascePrenotabili('asporto',fasce,occupazione,regole,adesso))).toEqual(['19:00','19:15','19:45'])
  expect(ore(fascePrenotabili('domicilio',fasce,occupazione,regole,adesso))).toEqual(['19:00','19:45'])
})
```


- [x] **Step 2:** `npx vitest run src/domain/ora-roma.test.ts src/domain/fasce.test.ts` → atteso **FAIL**: i moduli non esistono.
- [x] **Step 3: codice**

**Crea** `src/domain/ora-roma.ts` con:

```ts
// Date e ore del locale: sempre nel fuso di Roma, anche se il server gira in UTC.
const FORMATO = new Intl.DateTimeFormat('en-GB',{ timeZone: 'Europe/Rome',hourCycle: 'h23',year: 'numeric',month: '2-digit',day: '2-digit',hour: '2-digit',minute: '2-digit',second: '2-digit' })
export interface PartiRoma { anno: number; mese: number; giorno: number; ore: number; minuti: number }
export function partiRoma(istante: Date): PartiRoma {
  const p = Object.fromEntries(FORMATO.formatToParts(istante).map(x => [x.type,x.value]))
  return { anno: +p.year,mese: +p.month,giorno: +p.day,ore: +p.hour,minuti: +p.minute }
}
const due = (n: number) => String(n).padStart(2,'0')
/** Data di Roma nel formato `AAAA-MM-GG`. */
export function dataRoma(istante: Date): string {
  const p = partiRoma(istante)
  return `${p.anno}-${due(p.mese)}-${due(p.giorno)}`
}
/** Ora di Roma nel formato `HH:MM`. */
export function oraRoma(istante: Date): string {
  const p = partiRoma(istante)
  return `${due(p.ore)}:${due(p.minuti)}`
}
export function dataValida(data: unknown): data is string {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [a,m,g] = data.split('-').map(Number), d = new Date(Date.UTC(a,m - 1,g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g
}
/** Giorno della settimana di una data `AAAA-MM-GG`: 1 = lunedì … 7 = domenica. */
export function giornoSettimana(data: string): number {
  const [a,m,g] = data.split('-').map(Number)
  return new Date(Date.UTC(a,m - 1,g)).getUTCDay() || 7
}
// Differenza in millisecondi tra l'ora di Roma e l'UTC in quell'istante (+1 h d'inverno, +2 h d'estate).
function scarto(istante: Date): number {
  const p = partiRoma(istante)
  return Date.UTC(p.anno,p.mese - 1,p.giorno,p.ore,p.minuti) - Math.floor(istante.getTime() / 60000) * 60000
}
/** L'istante in cui a Roma sono le `minuti` (dalla mezzanotte) del giorno `data`. */
export function istanteRoma(data: string, minuti: number): Date {
  const [a,m,g] = data.split('-').map(Number)
  const comeUtc = Date.UTC(a,m - 1,g) + minuti * 60000
  // Il secondo passaggio corregge lo scarto nei giorni del cambio d'ora.
  const primo = comeUtc - scarto(new Date(comeUtc))
  return new Date(comeUtc - scarto(new Date(primo)))
}
```


**Crea** `src/domain/fasce.ts` con:

```ts
import { istanteRoma } from './ora-roma'
export type Servizio = 'asporto' | 'domicilio'
export const SERVIZI: readonly Servizio[] = ['asporto','domicilio']
export function servizioValido(s: unknown): s is Servizio { return s === 'asporto' || s === 'domicilio' }
export const DURATA_FASCIA = 15
export interface Turno { dalle: string; alle: string }
export interface RegoleFasce { capacitaFascia: number; capacitaConsegne: number; anticipoMinuti: number }
/** Ordini attivi (non rifiutati né annullati) già presenti in una fascia. */
export interface Occupazione { fascia: string; totale: number; domicilio: number }

/** Minuti dalla mezzanotte di un orario `HH:MM` (accetta anche `HH:MM:SS`), o null se non valido. */
export function minutiDa(orario: unknown): number | null {
  const m = typeof orario === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(orario) : null
  return m ? +m[1] * 60 + +m[2] : null
}
/** Inizi delle fasce di un giorno: da `dalle` ogni 15 minuti finché l'inizio è prima di `alle`. */
export function fasceDelGiorno(data: string, turni: Turno[]): Date[] {
  const minuti = new Set<number>()
  for (const t of turni) {
    const dalle = minutiDa(t.dalle), alle = minutiDa(t.alle)
    if (dalle === null || alle === null) continue
    for (let m = dalle; m < alle; m += DURATA_FASCIA) minuti.add(m)
  }
  return [...minuti].sort((a,b) => a - b).map(m => istanteRoma(data,m))
}
export function fasciaPrenotabile(servizio: Servizio, fascia: Date, occupata: { totale: number; domicilio: number }, regole: RegoleFasce, adesso: Date): boolean {
  if (fascia.getTime() < adesso.getTime() + regole.anticipoMinuti * 60000) return false
  if (occupata.totale >= regole.capacitaFascia) return false
  return servizio === 'asporto' || occupata.domicilio < regole.capacitaConsegne
}
export function fascePrenotabili(servizio: Servizio, fasce: Date[], occupazione: Occupazione[], regole: RegoleFasce, adesso: Date): Date[] {
  const vuota = { totale: 0,domicilio: 0 }
  const perFascia = new Map(occupazione.map(o => [new Date(o.fascia).getTime(),o]))
  return fasce.filter(f => fasciaPrenotabile(servizio,f,perFascia.get(f.getTime()) ?? vuota,regole,adesso))
}
```


- [x] **Step 4:** stesso comando → atteso **2 file, 8 test verdi** (compreso il giorno del cambio d'ora, 25/10/2026). Poi `npm run typecheck` e `npm run lint`.
- [x] **Step 5: commit** — `git add src/domain/ora-roma.ts src/domain/ora-roma.test.ts src/domain/fasce.ts src/domain/fasce.test.ts && git commit -m "Ora di Roma e fasce di 15 minuti"`

---

### Task 2: Stati da casa, dati del checkout, apertura degli ordini e allergeni della poke

**File:** crea in `src/domain/` i moduli `stati-casa`, `checkout`, `apertura-casa`, `allergeni-poke` e i loro test.

**Interfacce prodotte:**
- `stati-casa`:
  - `StatoCasa`, `STATI_CASA`, `STATI_ATTIVI_CASA`;
  - `prossimoStatoCasa(tipo,s)`, `puoAnnullareCasa(s)`, `azioneAvanzaCasa(tipo,s)`, `etichettaClienteCasa(tipo,s)`;
  - `colonnaCucina(stato)`, `MOTIVI_RIFIUTO`, `motivoRifiuto(motivo,altro)`, `attesaLunga(creatoIl,adesso)`.
- `checkout`: `DatiCheckout`, `ErroriCheckout`, `CampoCheckout`, `Pagamento`, `normalizzaTelefono`, `normalizzaEmail`, `validaCheckout(v)`, `totaliCasa(righeCent,tipo,zona)`.
- `apertura-casa`: `MotivoChiusura`, `DatiApertura`, `StatoApertura`, `TESTO_MOTIVO`, `aperturaServizio(servizio,d)`, `modalitaProva(env)`.
- `allergeni-poke`: `AllergeniVoci`, `AllergeniPoke`, `normalizzaAllergeniVoci(gruppi,dato)`, `allergeniScelte(voci,scelte)`.

- [x] **Step 1: test**

**Crea** `src/domain/stati-casa.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { attesaLunga, azioneAvanzaCasa, colonnaCucina, etichettaClienteCasa, motivoRifiuto, prossimoStatoCasa, puoAnnullareCasa, STATI_CASA } from './stati-casa'
it('asporto e domicilio seguono i loro passaggi; rifiutati, completati e annullati si fermano', () => {
  expect(prossimoStatoCasa('asporto','accettato')).toBe('in_preparazione')
  expect(prossimoStatoCasa('asporto','in_preparazione')).toBe('pronto')
  expect(prossimoStatoCasa('asporto','pronto')).toBe('completato')
  expect(prossimoStatoCasa('domicilio','pronto')).toBe('in_consegna')
  expect(prossimoStatoCasa('domicilio','in_consegna')).toBe('completato')
  for (const s of ['in_attesa','rifiutato','completato','annullato'] as const) expect(prossimoStatoCasa('domicilio',s)).toBeNull()
})
it('si annulla solo dopo l’accettazione e prima del completamento', () => {
  expect(STATI_CASA.filter(puoAnnullareCasa)).toEqual(['accettato','in_preparazione','pronto','in_consegna'])
})
it('testi per staff e cliente', () => {
  expect(azioneAvanzaCasa('asporto','pronto')).toBe('Ritirato')
  expect(azioneAvanzaCasa('domicilio','pronto')).toBe('Partito')
  expect(azioneAvanzaCasa('domicilio','in_consegna')).toBe('Consegnato')
  expect(azioneAvanzaCasa('domicilio','accettato')).toBe('In preparazione')
  expect(azioneAvanzaCasa('domicilio','in_attesa')).toBeNull()
  expect(etichettaClienteCasa('asporto','pronto')).toBe('Pronto per il ritiro')
  expect(etichettaClienteCasa('domicilio','completato')).toBe('Consegnato')
  expect(etichettaClienteCasa('asporto','in_attesa')).toBe('In attesa di conferma')
})
it('colonne della cucina per tavoli e casa', () => {
  expect(['inviato','accettato','in_preparazione','pronto','in_consegna','servito','in_attesa','completato'].map(colonnaCucina))
    .toEqual(['da_preparare','da_preparare','in_preparazione','pronti','pronti',null,null,null])
})
it('motivi di rifiuto: rapidi oppure «Altro» con testo', () => {
  expect(motivoRifiuto('Fascia piena','')).toBe('Fascia piena')
  expect(motivoRifiuto('Altro','  Manca il fattorino ')).toBe('Manca il fattorino')
  for (const [m,a] of [['Altro','  '],['Altro','x'.repeat(201)],['Inventato',''],[null,null]]) expect(motivoRifiuto(m,a)).toBeNull()
})
it('attesa lunga oltre i 10 minuti', () => {
  expect(attesaLunga('2026-10-12T18:00:00Z',new Date('2026-10-12T18:10:00Z'))).toBe(false)
  expect(attesaLunga('2026-10-12T18:00:00Z',new Date('2026-10-12T18:10:01Z'))).toBe(true)
})
```


**Crea** `src/domain/checkout.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { normalizzaEmail, normalizzaTelefono, totaliCasa, validaCheckout } from './checkout'
const zona = '11111111-1111-4111-8111-111111111111'
const base = { tipo: 'asporto',fascia: '2026-10-12T17:15:00.000Z',nome: ' Anna ',telefono: '333 123 4567',email: 'Anna@Esempio.IT ',pagamento: 'carta',privacy: true }
it('telefono italiano normalizzato, con o senza prefisso', () => {
  expect(normalizzaTelefono('+39 333.123-4567')).toBe('3331234567')
  expect(normalizzaTelefono('0039 080 1234567')).toBe('0801234567')
  expect(normalizzaTelefono('(080) 123456')).toBe('080123456')
  for (const t of ['12345','+41 79 123 45 67','33312345678901','333-abc-4567','',null]) expect(normalizzaTelefono(t)).toBeNull()
})
it('email in minuscolo e con un formato plausibile', () => {
  expect(normalizzaEmail(' Anna@Esempio.IT ')).toBe('anna@esempio.it')
  for (const e of ['anna@esempio','anna esempio@x.it','@x.it','a'.repeat(250) + '@x.it',3]) expect(normalizzaEmail(e)).toBeNull()
})
it('asporto valido: i campi del domicilio si ignorano', () => {
  expect(validaCheckout({ ...base,zonaId: 'x',indirizzo: '' })).toEqual({ ok: true,dati: {
    tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: new Date('2026-10-12T17:15:00.000Z'),
    nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null,
  } })
})
it('domicilio con contanti: zona, indirizzo, note e banconota', () => {
  const e = validaCheckout({ ...base,tipo: 'domicilio',zonaId: zona,indirizzo: ' Via Roma 1 ',noteConsegna: ' citofono Rossi ',pagamento: 'contanti',contantiDa: '50' })
  expect(e).toMatchObject({ ok: true,dati: { zonaId: zona,indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi',contantiDaCent: 5000 } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: '' })).toMatchObject({ ok: true,dati: { contantiDaCent: null } })
})
it('ogni campo sbagliato ha il suo messaggio', () => {
  const e = validaCheckout({ tipo: 'domicilio',zonaId: 'x',indirizzo: 'via',noteConsegna: 'x'.repeat(201),fascia: '2026-10-12 19:15',nome: '',telefono: '1',email: 'x',pagamento: 'bonifico',privacy: 'on' })
  expect(e.ok).toBe(false)
  if (!e.ok) expect(Object.keys(e.errori).sort()).toEqual(['email','fascia','indirizzo','nome','noteConsegna','pagamento','privacy','telefono','zonaId'])
  expect(validaCheckout({ ...base,tipo: 'tavolo' })).toMatchObject({ ok: false,errori: { tipo: expect.any(String) } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: '600' })).toMatchObject({ ok: false,errori: { contantiDa: expect.any(String) } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: 'cinquanta' })).toMatchObject({ ok: false,errori: { contantiDa: expect.any(String) } })
})
it('totali con consegna e importo mancante al minimo della zona', () => {
  expect(totaliCasa(1800,'domicilio',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 1800,consegnaCent: 200,totaleCent: 2000,mancanteCent: 200 })
  expect(totaliCasa(2500,'domicilio',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 2500,consegnaCent: 200,totaleCent: 2700,mancanteCent: 0 })
  expect(totaliCasa(1800,'asporto',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 1800,consegnaCent: 0,totaleCent: 1800,mancanteCent: 0 })
})
```


**Crea** `src/domain/apertura-casa.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { aperturaServizio, modalitaProva, type DatiApertura } from './apertura-casa'
const aperto: DatiApertura = { allergeniCompleti: true,telefono: '0801234567',apertiIl: '2026-10-12',oggi: '2026-10-12',chiusoOggi: false,zoneAttive: 1,fasceLibere: 3,prova: false }
it('aperto quando tutte le condizioni valgono', () => {
  expect(aperturaServizio('asporto',aperto)).toEqual({ aperto: true })
  expect(aperturaServizio('domicilio',aperto)).toEqual({ aperto: true })
})
it('il motivo è la prima condizione che manca', () => {
  const tutto = { ...aperto,allergeniCompleti: false,telefono: null,apertiIl: '2026-10-11',chiusoOggi: true,zoneAttive: 0,fasceLibere: 0 }
  expect(aperturaServizio('domicilio',tutto)).toEqual({ aperto: false,motivo: 'allergeni' })
  expect(aperturaServizio('domicilio',{ ...tutto,allergeniCompleti: true })).toEqual({ aperto: false,motivo: 'telefono' })
  expect(aperturaServizio('domicilio',{ ...aperto,apertiIl: null })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(aperturaServizio('domicilio',{ ...aperto,apertiIl: '2026-10-11' })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(aperturaServizio('domicilio',{ ...aperto,chiusoOggi: true })).toEqual({ aperto: false,motivo: 'chiusura' })
  expect(aperturaServizio('domicilio',{ ...aperto,zoneAttive: 0 })).toEqual({ aperto: false,motivo: 'zone' })
  expect(aperturaServizio('asporto',{ ...aperto,zoneAttive: 0 })).toEqual({ aperto: true })
  expect(aperturaServizio('asporto',{ ...aperto,fasceLibere: 0 })).toEqual({ aperto: false,motivo: 'fasce' })
})
it('la prova salta solo gli allergeni, e mai in produzione', () => {
  expect(aperturaServizio('asporto',{ ...aperto,allergeniCompleti: false,prova: true })).toEqual({ aperto: true })
  expect(aperturaServizio('asporto',{ ...aperto,allergeniCompleti: false,prova: true,apertiIl: null })).toEqual({ aperto: false,motivo: 'spenti' })
  expect(modalitaProva({ ORDINI_CASA_PROVA: '1',NODE_ENV: 'development' })).toBe(true)
  expect(modalitaProva({ ORDINI_CASA_PROVA: '1',NODE_ENV: 'production' })).toBe(false)
  expect(modalitaProva({ ORDINI_CASA_PROVA: 'true',NODE_ENV: 'development' })).toBe(false)
  expect(modalitaProva({ NODE_ENV: 'development' })).toBe(false)
})
```


**Crea** `src/domain/allergeni-poke.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { allergeniScelte, normalizzaAllergeniVoci } from './allergeni-poke'
const gruppi = [{ nome: 'Base',voci: ['Riso','Insalata'],min: 1,max: 1,inclusi: 1 },{ nome: 'Proteine',voci: ['Salmone','Tofu'],min: 1,max: 2,inclusi: 1 }]
it('normalizza: solo gruppi e voci esistenti, codici noti, ordine ufficiale', () => {
  const dato = { Base: { Riso: [],Pasta: ['glutine'] },Proteine: { Salmone: ['pesce'],Tofu: ['sesamo','soia','avocado'] },Altro: { X: ['latte'] } }
  expect(normalizzaAllergeniVoci(gruppi,dato)).toEqual({ Base: { Riso: [],Insalata: [] },Proteine: { Salmone: ['pesce'],Tofu: ['soia','sesamo'] } })
  expect(normalizzaAllergeniVoci(gruppi,'{}')).toEqual({ Base: { Riso: [],Insalata: [] },Proteine: { Salmone: [],Tofu: [] } })
  expect(normalizzaAllergeniVoci(gruppi,{ Base: { Riso: 'glutine' } }).Base.Riso).toEqual([])
})
it('allergeni delle scelte uniti senza ripetizioni', () => {
  const voci = normalizzaAllergeniVoci(gruppi,{ Base: { Riso: ['sesamo'] },Proteine: { Salmone: ['pesce','sesamo'],Tofu: ['soia'] } })
  expect(allergeniScelte(voci,{ Base: ['Riso'],Proteine: ['Salmone','Tofu'] })).toEqual(['pesce','soia','sesamo'])
  expect(allergeniScelte(voci,{ Base: ['Insalata'],Fantasma: ['X'] })).toEqual([])
})
```


- [x] **Step 2:** `npx vitest run src/domain/stati-casa.test.ts src/domain/checkout.test.ts src/domain/apertura-casa.test.ts src/domain/allergeni-poke.test.ts` → atteso **FAIL** (moduli mancanti).
- [x] **Step 3: codice**

**Crea** `src/domain/stati-casa.ts` con:

```ts
import type { Servizio } from './fasce'
export type StatoCasa = 'in_attesa' | 'accettato' | 'rifiutato' | 'in_preparazione' | 'pronto' | 'in_consegna' | 'completato' | 'annullato'
export const STATI_CASA: readonly StatoCasa[] = ['in_attesa','accettato','rifiutato','in_preparazione','pronto','in_consegna','completato','annullato']
/** Stati che occupano un posto nella fascia. */
export const STATI_ATTIVI_CASA: readonly StatoCasa[] = ['in_attesa','accettato','in_preparazione','pronto','in_consegna','completato']
export function prossimoStatoCasa(tipo: Servizio, s: StatoCasa): StatoCasa | null {
  if (s === 'accettato') return 'in_preparazione'
  if (s === 'in_preparazione') return 'pronto'
  if (s === 'pronto') return tipo === 'domicilio' ? 'in_consegna' : 'completato'
  if (s === 'in_consegna') return 'completato'
  return null
}
export function puoAnnullareCasa(s: StatoCasa): boolean { return s === 'accettato' || s === 'in_preparazione' || s === 'pronto' || s === 'in_consegna' }
/** Testo del bottone che porta l'ordine allo stato successivo. */
export function azioneAvanzaCasa(tipo: Servizio, s: StatoCasa): string | null {
  const prossimo = prossimoStatoCasa(tipo,s)
  if (!prossimo) return null
  return { in_preparazione: 'In preparazione',pronto: 'Pronto',in_consegna: 'Partito',completato: tipo === 'domicilio' ? 'Consegnato' : 'Ritirato' }[prossimo as 'in_preparazione' | 'pronto' | 'in_consegna' | 'completato']
}
export function etichettaClienteCasa(tipo: Servizio, s: StatoCasa): string {
  if (s === 'pronto') return tipo === 'domicilio' ? 'Pronto, sta per partire' : 'Pronto per il ritiro'
  if (s === 'completato') return tipo === 'domicilio' ? 'Consegnato' : 'Ritirato'
  return { in_attesa: 'In attesa di conferma',accettato: 'Confermato',rifiutato: 'Rifiutato',in_preparazione: 'In preparazione',in_consegna: 'In consegna',annullato: 'Annullato' }[s]
}
export type ColonnaCucina = 'da_preparare' | 'in_preparazione' | 'pronti'
/** Colonna della cucina per tavoli e casa; null se l'ordine non è più in cucina. */
export function colonnaCucina(stato: string): ColonnaCucina | null {
  if (stato === 'inviato' || stato === 'accettato') return 'da_preparare'
  if (stato === 'in_preparazione') return 'in_preparazione'
  if (stato === 'pronto' || stato === 'in_consegna') return 'pronti'
  return null
}
export const MOTIVI_RIFIUTO = ['Zona non servita','Fascia piena','Stiamo chiudendo'] as const
/** Motivo del rifiuto: uno dei motivi rapidi, oppure «Altro» con un testo di 1–200 caratteri. */
export function motivoRifiuto(motivo: unknown, altro: unknown): string | null {
  if (typeof motivo === 'string' && (MOTIVI_RIFIUTO as readonly string[]).includes(motivo)) return motivo
  if (motivo !== 'Altro' || typeof altro !== 'string') return null
  const testo = altro.trim()
  return testo.length >= 1 && testo.length <= 200 ? testo : null
}
export const MINUTI_ATTESA_LUNGA = 10
export function attesaLunga(creatoIl: Date | string, adesso: Date): boolean {
  return adesso.getTime() - new Date(creatoIl).getTime() > MINUTI_ATTESA_LUNGA * 60000
}
```


**Crea** `src/domain/checkout.ts` con:

```ts
import { servizioValido, type Servizio } from './fasce'
import { parseEuro } from './soldi'
import { idValido } from '@/tavoli/validazione'
export type Pagamento = 'contanti' | 'carta'
export interface DatiCheckout {
  tipo: Servizio; zonaId: string | null; indirizzo: string | null; noteConsegna: string | null; fascia: Date
  nome: string; telefono: string; email: string; pagamento: Pagamento; contantiDaCent: number | null
}
export type CampoCheckout = 'tipo' | 'zonaId' | 'indirizzo' | 'noteConsegna' | 'fascia' | 'nome' | 'telefono' | 'email' | 'pagamento' | 'contantiDa' | 'privacy'
export type ErroriCheckout = Partial<Record<CampoCheckout,string>>
export const MASSIMO_CONTANTI_CENT = 50000

/** Telefono italiano: tolti spazi e separatori e il prefisso +39/0039, restano 6–13 cifre. */
export function normalizzaTelefono(testo: unknown): string | null {
  if (typeof testo !== 'string' || testo.length > 40) return null
  let cifre = testo.replace(/[\s.\-()/]/g,'')
  if (cifre.startsWith('+39')) cifre = cifre.slice(3)
  else if (cifre.startsWith('0039')) cifre = cifre.slice(4)
  return /^\d{6,13}$/.test(cifre) ? cifre : null
}
export function normalizzaEmail(testo: unknown): string | null {
  if (typeof testo !== 'string') return null
  const email = testo.trim().toLowerCase()
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
const testo = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length >= min && t.length <= max ? t : null
}
/** Controlla i dati del checkout (non il carrello). I campi del domicilio si ignorano per l'asporto. */
export function validaCheckout(v: Record<string,unknown>): { ok: true; dati: DatiCheckout } | { ok: false; errori: ErroriCheckout } {
  const errori: ErroriCheckout = {}
  const tipo = servizioValido(v.tipo) ? v.tipo : null
  if (!tipo) errori.tipo = 'Scegli asporto o domicilio.'
  const domicilio = tipo === 'domicilio'
  const zonaId = domicilio ? (idValido(v.zonaId) ? v.zonaId : null) : null
  if (domicilio && !zonaId) errori.zonaId = 'Scegli la zona di consegna.'
  const indirizzo = domicilio ? testo(v.indirizzo,5,200) : null
  if (domicilio && !indirizzo) errori.indirizzo = 'Scrivi l’indirizzo (da 5 a 200 caratteri).'
  const note = domicilio && typeof v.noteConsegna === 'string' ? v.noteConsegna.trim() : ''
  if (note.length > 200) errori.noteConsegna = 'Al massimo 200 caratteri.'
  const fascia = typeof v.fascia === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(\.000)?Z$/.test(v.fascia) ? new Date(v.fascia) : null
  if (!fascia || !Number.isFinite(fascia.getTime())) errori.fascia = 'Scegli l’orario.'
  const nome = testo(v.nome,1,60)
  if (!nome) errori.nome = 'Scrivi il nome (al massimo 60 caratteri).'
  const telefono = normalizzaTelefono(v.telefono)
  if (!telefono) errori.telefono = 'Scrivi un numero di telefono italiano valido.'
  const email = normalizzaEmail(v.email)
  if (!email) errori.email = 'Scrivi un indirizzo email valido.'
  const pagamento = v.pagamento === 'contanti' || v.pagamento === 'carta' ? v.pagamento : null
  if (!pagamento) errori.pagamento = 'Scegli come pagherai.'
  let contantiDaCent: number | null = null
  if (pagamento === 'contanti' && typeof v.contantiDa === 'string' && v.contantiDa.trim()) {
    contantiDaCent = parseEuro(v.contantiDa)
    if (contantiDaCent === null || contantiDaCent > MASSIMO_CONTANTI_CENT) errori.contantiDa = 'Scrivi un importo valido, al massimo 500,00 €.'
  }
  if (v.privacy !== true) errori.privacy = 'Per ordinare devi accettare l’informativa privacy.'
  if (Object.keys(errori).length) return { ok: false,errori }
  return { ok: true,dati: { tipo: tipo!,zonaId,indirizzo,noteConsegna: note || null,fascia: fascia!,nome: nome!,telefono: telefono!,email: email!,pagamento: pagamento!,contantiDaCent } }
}
export interface TotaliCasa { righeCent: number; consegnaCent: number; totaleCent: number; mancanteCent: number }
/** Totale con la consegna; `mancanteCent` > 0 se il domicilio non raggiunge il minimo della zona. */
export function totaliCasa(righeCent: number, tipo: Servizio, zona: { costoCent: number; minimoCent: number } | null): TotaliCasa {
  const consegnaCent = tipo === 'domicilio' && zona ? zona.costoCent : 0
  const mancanteCent = tipo === 'domicilio' && zona ? Math.max(0,zona.minimoCent - righeCent) : 0
  return { righeCent,consegnaCent,totaleCent: righeCent + consegnaCent,mancanteCent }
}
```


**Crea** `src/domain/apertura-casa.ts` con:

```ts
import type { Servizio } from './fasce'
export type MotivoChiusura = 'allergeni' | 'telefono' | 'spenti' | 'chiusura' | 'zone' | 'fasce'
export interface DatiApertura {
  allergeniCompleti: boolean; telefono: string | null; apertiIl: string | null; oggi: string
  chiusoOggi: boolean; zoneAttive: number; fasceLibere: number; prova: boolean
}
export type StatoApertura = { aperto: true } | { aperto: false; motivo: MotivoChiusura }
export const TESTO_MOTIVO: Record<MotivoChiusura,string> = {
  allergeni: 'Stiamo aggiornando le informazioni sugli allergeni: gli ordini online riapriranno presto.',
  telefono: 'Ordini online non ancora attivi.',
  spenti: 'Ordini online chiusi in questo momento.',
  chiusura: 'Oggi siamo chiusi.',
  zone: 'Consegne a domicilio non disponibili.',
  fasce: 'Nessuna fascia libera per oggi.',
}
/** Primo motivo per cui il servizio è chiuso, nell'ordine della spec (§5.1). */
export function aperturaServizio(servizio: Servizio, d: DatiApertura): StatoApertura {
  if (!d.allergeniCompleti && !d.prova) return { aperto: false,motivo: 'allergeni' }
  if (!d.telefono) return { aperto: false,motivo: 'telefono' }
  if (d.apertiIl !== d.oggi) return { aperto: false,motivo: 'spenti' }
  if (d.chiusoOggi) return { aperto: false,motivo: 'chiusura' }
  if (servizio === 'domicilio' && d.zoneAttive === 0) return { aperto: false,motivo: 'zone' }
  if (d.fasceLibere === 0) return { aperto: false,motivo: 'fasce' }
  return { aperto: true }
}
/** Prova in locale senza allergeni confermati: mai in produzione. */
export function modalitaProva(env: { NODE_ENV?: string; ORDINI_CASA_PROVA?: string }): boolean {
  return env.ORDINI_CASA_PROVA === '1' && env.NODE_ENV !== 'production'
}
```


**Crea** `src/domain/allergeni-poke.ts` con:

```ts
import { ALLERGENI, eAllergene, type CodiceAllergene } from './allergeni'
import type { GruppoPoke } from '@/menu/importa'
import type { SceltePoke } from './poke'
/** Allergeni di ogni ingrediente: `{ gruppo: { voce: codici } }`. */
export type AllergeniVoci = Record<string,Record<string,CodiceAllergene[]>>
export interface AllergeniPoke { voci: AllergeniVoci; confermati: boolean }
/** Tiene solo gruppi e voci esistenti e codici noti, nell'ordine ufficiale dei 14 allergeni. */
export function normalizzaAllergeniVoci(gruppi: GruppoPoke[], dato: unknown): AllergeniVoci {
  const sorgente = dato && typeof dato === 'object' && !Array.isArray(dato) ? dato as Record<string,unknown> : {}
  const voci: AllergeniVoci = {}
  for (const g of gruppi) {
    const grezzo = Object.hasOwn(sorgente,g.nome) ? sorgente[g.nome] : null
    const gruppo = grezzo && typeof grezzo === 'object' && !Array.isArray(grezzo) ? grezzo as Record<string,unknown> : {}
    voci[g.nome] = {}
    for (const v of g.voci) {
      const codici = Object.hasOwn(gruppo,v) && Array.isArray(gruppo[v]) ? (gruppo[v] as unknown[]).filter((c): c is string => typeof c === 'string' && eAllergene(c)) : []
      voci[g.nome][v] = ALLERGENI.map(a => a.codice).filter(c => codici.includes(c))
    }
  }
  return voci
}
/** Allergeni della poke composta con queste scelte, senza ripetizioni. */
export function allergeniScelte(voci: AllergeniVoci, scelte: SceltePoke): CodiceAllergene[] {
  const tutti = new Set<CodiceAllergene>()
  for (const [gruppo,lista] of Object.entries(scelte)) for (const v of lista) for (const c of voci[gruppo]?.[v] ?? []) tutti.add(c)
  return ALLERGENI.map(a => a.codice).filter(c => tutti.has(c))
}
```


- [x] **Step 4:** stesso comando → atteso **4 file, 17 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add src/domain/stati-casa.ts src/domain/stati-casa.test.ts src/domain/checkout.ts src/domain/checkout.test.ts src/domain/apertura-casa.ts src/domain/apertura-casa.test.ts src/domain/allergeni-poke.ts src/domain/allergeni-poke.test.ts && git commit -m "Stati da casa, dati del checkout, apertura degli ordini e allergeni della poke"`

---

### Task 3: Migrazione degli ordini da casa

**File:** crea `supabase/migrations/20261013120000_domicilio_asporto.sql` e `tests/db/casa.test.ts`.

**Cosa fa la migrazione:**
- Nuove tabelle: `zone_consegna`, `orari_casa`, `chiusure_casa`, `impostazioni_casa` (riga `id=1` già inserita con i default) ed `email_ordini`.
- Su `ordini`: le colonne della casa e i vincoli `ordini_tipo_check`, `ordini_stato_check`, `ordini_tavolo_check` e `ordini_casa_check`, che sostituiscono i tre vecchi. Più gli indici.
- Su `poke_config`: `allergeni_voci` e `allergeni_confermati`.
- RLS e privilegi revocati sulle tabelle nuove.

Gli ordini dei tavoli già presenti restano validi: il primo test lo prova applicando la migrazione su un DB con ordini esistenti.

- [x] **Step 1: test**

**Crea** `tests/db/casa.test.ts` con:

```ts
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
afterEach(async () => { await ambiente.pg.close() })
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'
// Un ordine da casa valido: ogni test cambia solo le colonne che gli interessano.
function ordineCasa(diverso: Record<string,unknown> = {}) {
  const campi = { tipo: 'asporto',stato: 'in_attesa',totale_cent: 1000,token: TOKEN,fascia: '2026-10-12T17:15:00Z',cliente_nome: 'Anna',cliente_telefono: '3331234567',
    cliente_email: 'anna@esempio.it',consegna_cent: 0,pagamento: 'carta',privacy_il: '2026-10-12T16:00:00Z',...diverso }
  const nomi = Object.keys(campi)
  return ambiente.db.query(`insert into ordini (${nomi.join(',')}) values (${nomi.map((_,i) => `$${i + 1}`).join(',')}) returning id`,Object.values(campi))
}
describe('migrazione con dati esistenti', () => {
  it('gli ordini dei tavoli già presenti restano validi', async () => {
    ambiente = await creaDbDiTest({ primaDi: '20261013120000' })
    const { db,pg } = ambiente
    const [t] = await db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
    const [s] = await db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
    await db.query(`insert into ordini (sessione_id,totale_cent,stato) values ($1,600,'servito'),($1,0,'annullato')`,[s.id])
    await pg.exec(readFileSync('supabase/migrations/20261013120000_domicilio_asporto.sql','utf8'))
    expect(await db.query(`select tipo,stato from ordini order by stato`)).toEqual([{ tipo: 'tavolo',stato: 'annullato' },{ tipo: 'tavolo',stato: 'servito' }])
    await expect(db.query(`insert into ordini (sessione_id,totale_cent,stato) values ($1,600,'in_attesa')`,[s.id])).rejects.toThrow(/ordini_stato_check/)
    await expect(db.query(`insert into ordini (sessione_id,totale_cent,token) values ($1,600,$2)`,[s.id,TOKEN])).rejects.toThrow(/ordini_tavolo_check/)
  })
})
describe('schema degli ordini da casa', () => {
  beforeEach(async () => { ambiente = await creaDbDiTest() })
  it('impostazioni create con i valori di default e una sola riga', async () => {
    expect(await ambiente.db.query('select capacita_fascia,capacita_consegne,anticipo_minuti,telefono,aperti_il from impostazioni_casa'))
      .toEqual([{ capacita_fascia: 4,capacita_consegne: 2,anticipo_minuti: 30,telefono: null,aperti_il: null }])
    await expect(ambiente.db.query('insert into impostazioni_casa (id) values (2)')).rejects.toThrow()
    await expect(ambiente.db.query('update impostazioni_casa set capacita_consegne=5')).rejects.toThrow()
    await expect(ambiente.db.query(`update impostazioni_casa set telefono='080-123'`)).rejects.toThrow()
  })
  it('asporto valido; stato, token e dati del cliente controllati', async () => {
    await ordineCasa()
    await expect(ordineCasa({ token: 'corto' })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: TOKEN })).rejects.toThrow(/ordini_token_unico/)
    await expect(ordineCasa({ token: 'B'.repeat(32),stato: 'in_consegna' })).rejects.toThrow(/ordini_stato_check/)
    await expect(ordineCasa({ token: 'C'.repeat(32),cliente_email: null })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'D'.repeat(32),consegna_cent: 200 })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'E'.repeat(32),pagamento: 'carta',contanti_da_cent: 5000 })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ token: 'F'.repeat(32),privacy_il: null })).rejects.toThrow(/ordini_casa_check/)
  })
  it('domicilio: zona e indirizzo obbligatori, salvo dopo l’anonimizzazione', async () => {
    const dom = { tipo: 'domicilio',zona_nome: 'Bitetto',consegna_cent: 200,indirizzo: 'Via Roma 1' }
    await ordineCasa({ ...dom,stato: 'in_consegna' })
    await expect(ordineCasa({ ...dom,token: 'B'.repeat(32),indirizzo: null })).rejects.toThrow(/ordini_casa_check/)
    await expect(ordineCasa({ ...dom,token: 'C'.repeat(32),zona_nome: null })).rejects.toThrow(/ordini_casa_check/)
    await ordineCasa({ ...dom,token: 'D'.repeat(32),indirizzo: null,cliente_nome: null,cliente_telefono: null,cliente_email: null,anonimizzato_il: '2027-10-13T00:00:00Z' })
  })
  it('una sola email per tipo e per ordine, cancellata con l’ordine', async () => {
    const [o] = await ordineCasa()
    await ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[o.id])
    await expect(ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[o.id])).rejects.toThrow()
    await expect(ambiente.db.query(`insert into email_ordini (ordine_id,tipo) values ($1,'pronto')`,[o.id])).rejects.toThrow()
    await ambiente.db.query('delete from ordini where id=$1',[o.id])
    expect(await ambiente.db.query('select * from email_ordini')).toEqual([])
  })
  it('orari con inizio prima della fine e poke con allergeni vuoti di default', async () => {
    await ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',1,'19:00','23:00')`)
    await expect(ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',1,'23:00','19:00')`)).rejects.toThrow()
    await expect(ambiente.db.query(`insert into orari_casa (servizio,giorno,dalle,alle) values ('asporto',8,'19:00','23:00')`)).rejects.toThrow()
    await ambiente.db.query(`insert into poke_config (titolo,gruppi) values ('Poke','[]')`)
    expect(await ambiente.db.query('select allergeni_voci,allergeni_confermati from poke_config')).toEqual([{ allergeni_voci: {},allergeni_confermati: false }])
  })
  it('nessun accesso via API alle nuove tabelle', async () => {
    const tabelle = ['zone_consegna','orari_casa','chiusure_casa','impostazioni_casa','email_ordini']
    const righe = await ambiente.db.query<{ t: string; rls: boolean; anon: boolean; auth: boolean }>(`select c.relname as t,c.relrowsecurity as rls,
      has_table_privilege('anon',c.oid,'select') as anon,has_table_privilege('authenticated',c.oid,'select') as auth
      from pg_class c where c.relname = any($1::text[]) order by c.relname`,[tabelle])
    expect(righe).toEqual(tabelle.sort().map(t => ({ t,rls: true,anon: false,auth: false })))
  })
})
```


- [x] **Step 2:** `npx vitest run tests/db/casa.test.ts` → atteso **FAIL**: il file della migrazione non esiste (`ENOENT`) e le tabelle mancano.
- [x] **Step 3: migrazione**

**Crea** `supabase/migrations/20261013120000_domicilio_asporto.sql` con:

```sql
-- Tappa 3: ordini da casa (asporto e domicilio), zone, orari, chiusure, coda delle email.
-- Solo aggiunte: gli ordini dei tavoli già presenti restano validi.
create table public.zone_consegna (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 60),
  costo_cent int not null check (costo_cent between 0 and 100000),
  minimo_cent int not null check (minimo_cent between 0 and 1000000),
  attiva boolean not null default true,
  posizione int not null default 0
);
create table public.orari_casa (
  id uuid primary key default gen_random_uuid(),
  servizio text not null check (servizio in ('asporto','domicilio')),
  giorno int not null check (giorno between 1 and 7),
  dalle time not null,
  alle time not null,
  check (dalle < alle)
);
create index orari_casa_giorno on public.orari_casa(servizio,giorno);
create table public.chiusure_casa (
  data date primary key,
  motivo text check (motivo is null or length(motivo) <= 100)
);
create table public.impostazioni_casa (
  id int primary key default 1 check (id = 1),
  capacita_fascia int not null default 4 check (capacita_fascia between 1 and 50),
  capacita_consegne int not null default 2 check (capacita_consegne between 0 and 50),
  anticipo_minuti int not null default 30 check (anticipo_minuti between 0 and 240),
  telefono text check (telefono is null or telefono ~ '^[0-9]{6,13}$'),
  aperti_il date,
  check (capacita_consegne <= capacita_fascia)
);
insert into public.impostazioni_casa (id) values (1);

alter table public.ordini drop constraint ordini_tipo_check;
alter table public.ordini drop constraint ordini_stato_check;
alter table public.ordini drop constraint ordini_check;
alter table public.ordini
  add column token text,
  add column fascia timestamptz,
  add column cliente_nome text check (cliente_nome is null or length(cliente_nome) between 1 and 60),
  add column cliente_telefono text check (cliente_telefono is null or cliente_telefono ~ '^[0-9]{6,13}$'),
  add column cliente_email text check (cliente_email is null or length(cliente_email) between 3 and 254),
  add column zona_id uuid references public.zone_consegna(id) on delete set null,
  add column zona_nome text check (zona_nome is null or length(zona_nome) between 1 and 60),
  add column consegna_cent int,
  add column indirizzo text check (indirizzo is null or length(indirizzo) between 5 and 200),
  add column note_consegna text check (note_consegna is null or length(note_consegna) <= 200),
  add column pagamento text,
  add column contanti_da_cent int,
  add column privacy_il timestamptz,
  add column motivo_rifiuto text check (motivo_rifiuto is null or length(motivo_rifiuto) between 1 and 200),
  add column rete text,
  add column anonimizzato_il timestamptz;
alter table public.ordini add constraint ordini_tipo_check check (tipo in ('tavolo','asporto','domicilio'));
alter table public.ordini add constraint ordini_stato_check check (
  (tipo = 'tavolo' and stato in ('inviato','in_preparazione','servito','annullato'))
  or (tipo = 'asporto' and stato in ('in_attesa','accettato','rifiutato','in_preparazione','pronto','completato','annullato'))
  or (tipo = 'domicilio' and stato in ('in_attesa','accettato','rifiutato','in_preparazione','pronto','in_consegna','completato','annullato'))
);
alter table public.ordini add constraint ordini_tavolo_check check (
  tipo <> 'tavolo' or (sessione_id is not null and token is null and fascia is null and consegna_cent is null and pagamento is null and cliente_nome is null)
);
alter table public.ordini add constraint ordini_casa_check check (
  tipo = 'tavolo' or (
    sessione_id is null and token ~ '^[A-Za-z0-9_-]{32}$' and fascia is not null and privacy_il is not null
    and consegna_cent between 0 and 100000 and pagamento in ('contanti','carta')
    and (contanti_da_cent is null or (pagamento = 'contanti' and contanti_da_cent between 0 and 50000))
    and (anonimizzato_il is not null or (cliente_nome is not null and cliente_telefono is not null and cliente_email is not null))
    and ((tipo = 'asporto' and consegna_cent = 0 and zona_nome is null and indirizzo is null and note_consegna is null)
      or (tipo = 'domicilio' and zona_nome is not null and (anonimizzato_il is not null or indirizzo is not null)))
  )
);
create unique index ordini_token_unico on public.ordini(token) where token is not null;
create index ordini_casa_fascia on public.ordini(fascia) where tipo <> 'tavolo';
create index ordini_casa_in_attesa_telefono on public.ordini(cliente_telefono) where stato = 'in_attesa';
create index ordini_casa_rete on public.ordini(rete,creato_il) where rete is not null;
create index ordini_casa_da_anonimizzare on public.ordini(creato_il) where tipo <> 'tavolo' and anonimizzato_il is null;

create table public.email_ordini (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini(id) on delete cascade,
  tipo text not null check (tipo in ('ricevuto','accettato','rifiutato','annullato')),
  creata_il timestamptz not null default now(),
  inviata_il timestamptz,
  in_invio_dal timestamptz,
  tentativi int not null default 0 check (tentativi >= 0),
  ultimo_errore text check (ultimo_errore is null or length(ultimo_errore) <= 500),
  unique (ordine_id,tipo)
);
create index email_ordini_da_inviare on public.email_ordini(creata_il) where inviata_il is null;

alter table public.poke_config add column allergeni_voci jsonb not null default '{}'::jsonb check (jsonb_typeof(allergeni_voci) = 'object');
alter table public.poke_config add column allergeni_confermati boolean not null default false;

alter table public.zone_consegna enable row level security;
alter table public.orari_casa enable row level security;
alter table public.chiusure_casa enable row level security;
alter table public.impostazioni_casa enable row level security;
alter table public.email_ordini enable row level security;
revoke all on public.zone_consegna, public.orari_casa, public.chiusure_casa, public.impostazioni_casa, public.email_ordini from anon, authenticated;
```


- [x] **Step 4:** stesso comando → atteso **1 file, 7 test verdi**. Poi `npm test` → nessuna regressione nei test esistenti (**48 file, 224 test**).
- [x] **Step 5: commit** — `git add supabase/migrations/20261013120000_domicilio_asporto.sql tests/db/casa.test.ts && git commit -m "Schema degli ordini da casa: zone, orari, chiusure, impostazioni e coda email"`

---

### Task 4: Allergeni degli ingredienti della poke

**File:**
- modifica `src/tavoli/poke-repo.ts` (+test) e `src/app/admin/poke/azioni.ts` (+test);
- sostituisci `src/app/admin/poke/page.tsx`;
- crea `src/app/admin/poke/ModuloAllergeniPoke.tsx`.

**Interfacce prodotte:** `leggiAllergeniPoke(db,config): Promise<AllergeniPoke>`, `salvaAllergeniPoke(db,a)`, azione `salvaAllergeniPokeAdmin(stato,fd)` con `StatoAllergeniPoke`.

- [x] **Step 1: test**

**Sostituisci tutto il contenuto** di `src/tavoli/poke-repo.test.ts` con:

```ts
import { expect, it, vi } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { leggiAllergeniPoke, leggiPokeConfig, salvaAllergeniPoke, salvaPokeConfig } from './poke-repo'
it('allergeni degli ingredienti: vuoti di default, salvati e ripuliti dalle voci che non esistono più', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  try {
    const c = (await leggiPokeConfig(db))!
    const base = c.gruppi[0]
    const vuoti = await leggiAllergeniPoke(db,c)
    expect(vuoti.confermati).toBe(false)
    expect(vuoti.voci[base.nome][base.voci[0]]).toEqual([])
    await salvaAllergeniPoke(db,{ voci: { ...vuoti.voci,[base.nome]: { ...vuoti.voci[base.nome],[base.voci[0]]: ['sesamo','glutine'],Sparito: ['latte'] } },confermati: true })
    const letti = await leggiAllergeniPoke(db,c)
    expect(letti.confermati).toBe(true)
    expect(letti.voci[base.nome][base.voci[0]]).toEqual(['glutine','sesamo'])
    expect(Object.hasOwn(letti.voci[base.nome],'Sparito')).toBe(false)
  } finally { await pg.close() }
})
it('legge seed e salva prezzi e regole della poke', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  try {
    const c = (await leggiPokeConfig(db))!
    expect(c.gruppi).toHaveLength(5)
    expect(c.prezzoBaseCent).toBeNull()
    c.prezzoBaseCent = 900; c.prezzoExtraCent = 100; c.gruppi[0].min = 0
    await salvaPokeConfig(db, c)
    expect(await leggiPokeConfig(db)).toEqual(c)
  } finally { await pg.close() }
})
it('rifiuta gruppi serializzati come stringa e forme corrotte senza rompere la lettura', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  const log = vi.spyOn(console,'error').mockImplementation(() => {})
  try {
    const config = (await leggiPokeConfig(db))!
    const gruppo = config.gruppi[0]
    const errati = ['[]',null,{},[{ ...gruppo,voci: [1] }],[{ ...gruppo,min: 0.5 }],[{ ...gruppo,max: -1 }],[{ ...gruppo,inclusi: gruppo.max+1 }]]
    for (const gruppi of errati) {
      await db.query('update poke_config set gruppi=$1::text::jsonb where id=1',[JSON.stringify(gruppi)])
      expect(await leggiPokeConfig(db)).toBeNull()
    }
    expect(log).toHaveBeenCalledTimes(errati.length)
    expect(log).toHaveBeenCalledWith('poke_config non valida')
  } finally { log.mockRestore(); await pg.close() }
})
```


**Sostituisci tutto il contenuto** di `src/app/admin/poke/azioni.test.ts` con:

```ts
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), leggiPokeConfig: vi.fn(), salvaPokeConfig: vi.fn(), salvaAllergeniPoke: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/tavoli/poke-repo', () => ({ leggiPokeConfig: m.leggiPokeConfig, salvaPokeConfig: m.salvaPokeConfig, salvaAllergeniPoke: m.salvaAllergeniPoke }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
import { salvaAllergeniPokeAdmin, salvaPoke, type StatoPoke } from './azioni'
it('allergeni della poke: admin prima di tutto, caselle per ingrediente e conferma', async () => {
  const f = new FormData(); f.append('allergeni_0_0','sesamo'); f.append('allergeni_0_0','avocado'); f.set('confermati','on')
  expect(await salvaAllergeniPokeAdmin({ salvato: false,errore: null,invii: 0 },f)).toEqual({ salvato: true,errore: null,invii: 1 })
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.leggiPokeConfig.mock.invocationCallOrder[0])
  expect(m.salvaAllergeniPoke).toHaveBeenCalledWith({},{ voci: { Base: { Riso: ['sesamo'] } },confermati: true })
  m.salvaAllergeniPoke.mockRejectedValueOnce(new Error('connessione'))
  expect((await salvaAllergeniPokeAdmin({ salvato: false,errore: null,invii: 1 },new FormData())).errore).toContain('Salvataggio non riuscito')
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(salvaAllergeniPokeAdmin({ salvato: false,errore: null,invii: 0 },f)).rejects.toThrow('NEXT_REDIRECT')
})
const stato: StatoPoke = { salvato: false, errore: null, valori: null, invii: 0 }
function fd() { const f = new FormData(); f.set('base','9,00'); f.set('extra','1,00'); f.set('min_0','1'); f.set('max_0','1'); f.set('inclusi_0','1'); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.leggiPokeConfig.mockResolvedValue({ titolo: 'Poke', gruppi: [{ nome: 'Base', voci: ['Riso'], min: 1, max: 1, inclusi: 1 }], prezzoBaseCent: null, prezzoExtraCent: null }) })
it('salva prezzi e regole dopo la verifica admin', async () => {
  expect((await salvaPoke(stato,fd())).salvato).toBe(true)
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.leggiPokeConfig.mock.invocationCallOrder[0])
  expect(m.salvaPokeConfig.mock.calls[0][1]).toMatchObject({ prezzoBaseCent: 900, prezzoExtraCent: 100 })
})
it('preserva i valori se le regole o i prezzi non sono validi', async () => {
  const f = fd(); f.set('max_0','5')
  const s = await salvaPoke(stato,f)
  expect(s.salvato).toBe(false); expect(s.valori?.gruppi[0].max).toBe('5'); expect(s.invii).toBe(1)
  expect(m.salvaPokeConfig).not.toHaveBeenCalled()
  f.set('base',''); expect((await salvaPoke(stato,f)).errore).toBeTruthy()
})
it('propaga redirect e gestisce errore DB', async () => {
  m.richiediRuolo.mockRejectedValueOnce(new Error('NEXT_REDIRECT'))
  await expect(salvaPoke(stato,fd())).rejects.toThrow('NEXT_REDIRECT')
  m.leggiPokeConfig.mockRejectedValueOnce(new Error('connessione'))
  expect((await salvaPoke(stato,fd())).errore).toBeTruthy()
})
```


- [x] **Step 2:** `npx vitest run src/tavoli/poke-repo.test.ts src/app/admin/poke/azioni.test.ts` → atteso **FAIL** (funzioni non esportate).
- [x] **Step 3: codice**

**Sostituisci tutto il contenuto** di `src/tavoli/poke-repo.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import type { PokeConfig } from '@/menu/importa'
import { normalizzaAllergeniVoci, type AllergeniPoke } from '@/domain/allergeni-poke'

export async function leggiPokeConfig(db: Db): Promise<PokeConfig | null> {
  const c = (await db.query<PokeConfig>('select titolo,gruppi,prezzo_base_cent as "prezzoBaseCent",prezzo_extra_cent as "prezzoExtraCent" from poke_config where id=1'))[0]
  if (!c) return null
  const testo = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const prezzo = (v: unknown) => v === null || (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 2147483647)
  const valida = testo(c.titolo) && prezzo(c.prezzoBaseCent) && prezzo(c.prezzoExtraCent) && Array.isArray(c.gruppi) && c.gruppi.length > 0 && c.gruppi.every(g =>
    g && typeof g === 'object' && testo(g.nome) && Array.isArray(g.voci) && g.voci.every(testo) && new Set(g.voci).size === g.voci.length &&
    [g.min,g.max,g.inclusi].every(Number.isSafeInteger) && g.min >= 0 && g.min <= g.max && g.max <= g.voci.length && g.inclusi >= 0 && g.inclusi <= g.max
  ) && new Set(c.gruppi.map(g => g.nome)).size === c.gruppi.length
  if (!valida) { console.error('poke_config non valida'); return null }
  return c
}
export async function salvaPokeConfig(db: Db, c: PokeConfig): Promise<void> {
  await db.query('update poke_config set titolo=$1,gruppi=$2::text::jsonb,prezzo_base_cent=$3,prezzo_extra_cent=$4 where id=1', [c.titolo,JSON.stringify(c.gruppi),c.prezzoBaseCent,c.prezzoExtraCent])
}
/** Allergeni degli ingredienti, ripuliti rispetto ai gruppi attuali. Senza riga: nessun allergene, non confermati. */
export async function leggiAllergeniPoke(db: Db, config: PokeConfig): Promise<AllergeniPoke> {
  const [r] = await db.query<{ voci: unknown; confermati: boolean }>('select allergeni_voci as voci,allergeni_confermati as confermati from poke_config where id=1')
  return { voci: normalizzaAllergeniVoci(config.gruppi,r?.voci),confermati: r?.confermati ?? false }
}
export async function salvaAllergeniPoke(db: Db, a: AllergeniPoke): Promise<void> {
  await db.query('update poke_config set allergeni_voci=$1::text::jsonb,allergeni_confermati=$2 where id=1',[JSON.stringify(a.voci),a.confermati])
}
```


**Sostituisci tutto il contenuto** di `src/app/admin/poke/azioni.ts` con:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { parseEuro } from '@/domain/soldi'
import { leggiPokeConfig, salvaPokeConfig, salvaAllergeniPoke } from '@/tavoli/poke-repo'
import { normalizzaAllergeniVoci } from '@/domain/allergeni-poke'

export interface ValoriPoke { base: string; extra: string; gruppi: { min: string; max: string; inclusi: string }[] }
export interface StatoPoke { salvato: boolean; errore: string | null; valori: ValoriPoke | null; invii: number }
export async function salvaPoke(stato: StatoPoke, fd: FormData): Promise<StatoPoke> {
  await richiediRuolo('admin')
  const testo = (nome: string) => typeof fd.get(nome) === 'string' ? fd.get(nome) as string : ''
  const valori: ValoriPoke = { base: testo('base'), extra: testo('extra'), gruppi: [] }
  const invii = stato.invii + 1
  const errore = (messaggio: string): StatoPoke => ({ salvato: false, errore: messaggio, valori, invii })
  try {
    const config = await leggiPokeConfig(db)
    if (!config) return errore('Configurazione della poke non trovata.')
    valori.gruppi = config.gruppi.map((_,i) => ({ min: testo(`min_${i}`), max: testo(`max_${i}`), inclusi: testo(`inclusi_${i}`) }))
    const base = parseEuro(valori.base), extra = parseEuro(valori.extra)
    if (base === null || extra === null) return errore('Inserisci un prezzo base e un prezzo extra validi.')
    const gruppi = config.gruppi.map((g,i) => ({ ...g, min: Number(valori.gruppi[i].min), max: Number(valori.gruppi[i].max), inclusi: Number(valori.gruppi[i].inclusi) }))
    for (const [i,g] of gruppi.entries()) {
      if (Object.values(valori.gruppi[i]).some(v => !/^\d+$/.test(v)) || ![g.min,g.max,g.inclusi].every(Number.isSafeInteger) || g.min < 0 || g.min > g.max || g.max > g.voci.length || g.inclusi < 0 || g.inclusi > g.max) return errore(`Controlla minimo, massimo e inclusi in ${g.nome}.`)
    }
    await salvaPokeConfig(db,{ ...config, gruppi, prezzoBaseCent: base, prezzoExtraCent: extra })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return errore('Salvataggio non riuscito: controlla la connessione e riprova.')
  }
  revalidatePath('/admin/poke')
  revalidatePath('/tavolo/[chiave]','page')
  return { salvato: true, errore: null, valori: null, invii }
}
export interface StatoAllergeniPoke { salvato: boolean; errore: string | null; invii: number }
// Caselle `allergeni_<gruppo>_<voce>` con i codici scelti; i codici sconosciuti vengono scartati dal repo.
export async function salvaAllergeniPokeAdmin(stato: StatoAllergeniPoke, fd: FormData): Promise<StatoAllergeniPoke> {
  await richiediRuolo('admin')
  const invii = stato.invii + 1
  try {
    const config = await leggiPokeConfig(db)
    if (!config) return { salvato: false, errore: 'Configurazione della poke non trovata.', invii }
    const voci = Object.fromEntries(config.gruppi.map((g,gi) => [g.nome,Object.fromEntries(g.voci.map((v,vi) => [v,fd.getAll(`allergeni_${gi}_${vi}`).filter(c => typeof c === 'string')]))]))
    await salvaAllergeniPoke(db,{ voci: normalizzaAllergeniVoci(config.gruppi,voci),confermati: fd.get('confermati') === 'on' })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { salvato: false, errore: 'Salvataggio non riuscito: controlla la connessione e riprova.', invii }
  }
  revalidatePath('/admin/poke'); revalidatePath('/'); revalidatePath('/ordina')
  return { salvato: true, errore: null, invii }
}
```


**Crea** `src/app/admin/poke/ModuloAllergeniPoke.tsx` con:

```tsx
'use client'
import { useActionState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import type { AllergeniPoke } from '@/domain/allergeni-poke'
import { ALLERGENI } from '@/domain/allergeni'
import { salvaAllergeniPokeAdmin, type StatoAllergeniPoke } from './azioni'
const INIZIALE: StatoAllergeniPoke = { salvato: false,errore: null,invii: 0 }
export function ModuloAllergeniPoke({ config,allergeni }: { config: PokeConfig; allergeni: AllergeniPoke }) {
  const [stato,azione,inCorso] = useActionState(salvaAllergeniPokeAdmin,INIZIALE)
  return <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
    {config.gruppi.map((g,gi) => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend>
      {g.voci.map((v,vi) => <details key={v}>
        <summary>{v}{allergeni.voci[g.nome]?.[v]?.length ? ` · ${allergeni.voci[g.nome][v].length} allergeni` : ' · nessun allergene'}</summary>
        <div className="admin-griglia-allergeni">{ALLERGENI.map(a => <label key={a.codice}>
          <input type="checkbox" name={`allergeni_${gi}_${vi}`} value={a.codice} defaultChecked={allergeni.voci[g.nome]?.[v]?.includes(a.codice)} /> {a.etichetta}
        </label>)}</div>
      </details>)}
    </fieldset>)}
    <label className="admin-tavolo-check"><input type="checkbox" name="confermati" defaultChecked={allergeni.confermati} /> <strong>Ho verificato gli allergeni di tutti gli ingredienti</strong></label>
    {stato.errore && <p role="alert">{stato.errore}</p>}
    {stato.salvato && <p role="status">Salvato.</p>}
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva allergeni'}</button>
  </form>
}
```


**Sostituisci tutto il contenuto** di `src/app/admin/poke/page.tsx` con:

```tsx
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { ModuloPoke } from './ModuloPoke'
import { ModuloAllergeniPoke } from './ModuloAllergeniPoke'
export default async function PokeAdmin() {
  await richiediRuolo('admin')
  const config = await leggiPokeConfig(db)
  const allergeni = config ? await leggiAllergeniPoke(db,config) : null
  return <><h1 className="heading">Regole della poke</h1><p>Imposta quantità incluse, limiti e prezzi. Gli ingredienti sono quelli del menù.</p>
    {config && allergeni ? <>
      <ModuloPoke config={config} />
      <h2 className="heading">Allergeni degli ingredienti</h2>
      {!allergeni.confermati && <p className="admin-avviso">Finché non confermi gli allergeni di tutti gli ingredienti, la poke composta non si può ordinare da casa. Al tavolo resta ordinabile.</p>}
      <ModuloAllergeniPoke config={config} allergeni={allergeni} />
    </> : <p>Configurazione della poke non trovata: importa prima il menù.</p>}</>
}
```


- [x] **Step 4:** stesso comando → atteso **2 file, 7 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add src/tavoli/poke-repo.ts src/tavoli/poke-repo.test.ts src/app/admin/poke && git commit -m "Allergeni degli ingredienti della poke"`

---

### Task 5: Impostazioni da casa e disponibilità di oggi

**File:** crea `src/casa/impostazioni-repo.ts` (+test) e `src/casa/disponibilita.ts`.

**Interfacce prodotte:**
- tipi `ImpostazioniCasa`, `Zona`, `DatiZona`, `Orario`, `Chiusura`;
- impostazioni: `leggiImpostazioni`, `salvaImpostazioni`, `impostaApertura(db,data|null)`;
- zone: `elencoZone(db,soloAttive?)`, `zonaPerId`, `creaZona`, `salvaZona`;
- orari: `elencoOrari`, `turniDelGiorno(db,servizio,giorno)`, `aggiungiOrario`, `rimuoviOrario`;
- chiusure: `elencoChiusure(db,daData)`, `chiusoIl`, `aggiungiChiusura`, `rimuoviChiusura`;
- `allergeniCompleti(db)`;
- disponibilità: `occupazioneFasce(db,oggi)`, `leggiDisponibilita(db,adesso,prova): DisponibilitaCasa`.

- [x] **Step 1: test**

**Crea** `src/casa/impostazioni-repo.test.ts` con:

```ts
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { aggiungiChiusura, aggiungiOrario, allergeniCompleti, creaZona, elencoChiusure, elencoOrari, elencoZone, impostaApertura, leggiImpostazioni, rimuoviChiusura, rimuoviOrario, salvaImpostazioni, salvaZona, turniDelGiorno, zonaPerId } from './impostazioni-repo'
import { leggiDisponibilita } from './disponibilita'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest() })
afterEach(async () => { await ambiente.pg.close() })
// Lunedì 12/10/2026 alle 18:00 di Roma.
const ADESSO = new Date('2026-10-12T16:00:00Z')
async function prepara() {
  const { db } = ambiente
  await salvaImpostazioni(db,{ capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '19:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '19:00' })
  return creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
}
it('impostazioni, apertura del giorno e telefono', async () => {
  const { db } = ambiente
  await salvaImpostazioni(db,{ capacitaFascia: 6,capacitaConsegne: 3,anticipoMinuti: 45,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  expect(await leggiImpostazioni(db)).toEqual({ capacitaFascia: 6,capacitaConsegne: 3,anticipoMinuti: 45,telefono: '0801234567',apertiIl: '2026-10-12' })
  await impostaApertura(db,null)
  expect((await leggiImpostazioni(db)).apertiIl).toBeNull()
})
it('zone: creazione, modifica, disattivazione e id non validi', async () => {
  const { db } = ambiente
  const z = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 1 })
  await creaZona(db,{ nome: 'Palo del Colle',costoCent: 300,minimoCent: 2000,attiva: true,posizione: 0 })
  expect((await elencoZone(db)).map(z => z.nome)).toEqual(['Palo del Colle','Bitetto'])
  expect(await salvaZona(db,z.id,{ nome: 'Bitetto centro',costoCent: 0,minimoCent: 1000,attiva: false,posizione: 1 })).toBe(true)
  expect(await zonaPerId(db,z.id)).toEqual({ id: z.id,nome: 'Bitetto centro',costoCent: 0,minimoCent: 1000,attiva: false,posizione: 1 })
  expect((await elencoZone(db,true)).map(z => z.nome)).toEqual(['Palo del Colle'])
  expect(await salvaZona(db,'x',{ nome: 'X',costoCent: 0,minimoCent: 0,attiva: true,posizione: 0 })).toBe(false)
  expect(await zonaPerId(db,'x')).toBeNull()
})
it('orari e chiusure', async () => {
  const { db } = ambiente
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '19:00',alle: '23:00' })
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '12:00',alle: '14:30' })
  expect(await turniDelGiorno(db,'asporto',1)).toEqual([{ dalle: '12:00',alle: '14:30' },{ dalle: '19:00',alle: '23:00' }])
  expect(await turniDelGiorno(db,'domicilio',1)).toEqual([])
  const [primo] = await elencoOrari(db)
  expect(await rimuoviOrario(db,primo.id)).toBe(true)
  expect(await rimuoviOrario(db,primo.id)).toBe(false)
  await aggiungiChiusura(db,'2026-10-11','Ieri')
  await aggiungiChiusura(db,'2026-12-25',null)
  await aggiungiChiusura(db,'2026-12-25','Natale')
  expect(await elencoChiusure(db,'2026-10-12')).toEqual([{ data: '2026-12-25',motivo: 'Natale' }])
  expect(await rimuoviChiusura(db,'2026-12-25')).toBe(true)
})
it('allergeni completi solo se tutti i piatti disponibili sono confermati', async () => {
  const { db } = ambiente
  await db.query(`insert into categorie (id,nome,posizione) values ('c','C',1)`)
  await db.query(`insert into piatti (categoria_id,nome,prezzo_cent,posizione,allergeni_confermati,disponibile) values ('c','A',100,1,true,true),('c','B',100,2,false,false)`)
  expect(await allergeniCompleti(db)).toBe(true)
  await db.query(`update piatti set disponibile=true where nome='B'`)
  expect(await allergeniCompleti(db)).toBe(false)
})
it('disponibilità: fasce di oggi per servizio, con capacità e consegne occupate', async () => {
  const { db } = ambiente
  await prepara()
  const d = await leggiDisponibilita(db,ADESSO,true)
  expect(d.oggi).toBe('2026-10-12')
  expect(d.servizi.asporto).toEqual({ apertura: { aperto: true },fasce: ['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'] })
  expect(d.servizi.domicilio).toEqual({ apertura: { aperto: true },fasce: ['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'] })
  await db.query(`insert into ordini (tipo,stato,totale_cent,token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_nome,consegna_cent,indirizzo,pagamento,privacy_il)
    values ('domicilio','in_attesa',1700,$1,'2026-10-12T16:30:00Z','A','3331234567','a@b.it','Bitetto',200,'Via Roma 1','carta',now()),
           ('asporto','rifiutato',1700,$2,'2026-10-12T16:45:00Z','A','3331234567','a@b.it',null,0,null,'carta',now())`,['A'.repeat(32),'B'.repeat(32)])
  const dopo = await leggiDisponibilita(db,ADESSO,true)
  expect(dopo.servizi.asporto.fasce).toEqual(['2026-10-12T16:30:00.000Z','2026-10-12T16:45:00.000Z'])
  expect(dopo.servizi.domicilio.fasce).toEqual(['2026-10-12T16:45:00.000Z'])
})
it('disponibilità: allergeni, interruttore di ieri e giorno di chiusura', async () => {
  const { db } = ambiente
  await prepara()
  await db.query(`insert into categorie (id,nome,posizione) values ('c','C',1)`)
  await db.query(`insert into piatti (categoria_id,nome,prezzo_cent,posizione) values ('c','A',100,1)`)
  expect((await leggiDisponibilita(db,ADESSO,false)).servizi.asporto).toEqual({ apertura: { aperto: false,motivo: 'allergeni' },fasce: [] })
  await impostaApertura(db,'2026-10-11')
  expect((await leggiDisponibilita(db,ADESSO,true)).servizi.asporto.apertura).toEqual({ aperto: false,motivo: 'spenti' })
  await impostaApertura(db,'2026-10-12'); await aggiungiChiusura(db,'2026-10-12',null)
  expect((await leggiDisponibilita(db,ADESSO,true)).servizi.domicilio.apertura).toEqual({ aperto: false,motivo: 'chiusura' })
})
```


- [x] **Step 2:** `npx vitest run src/casa/impostazioni-repo.test.ts` → atteso **FAIL**.
- [x] **Step 3: codice**

**Crea** `src/casa/impostazioni-repo.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import type { Servizio, Turno } from '@/domain/fasce'
import { idValido } from '@/tavoli/validazione'
export interface ImpostazioniCasa { capacitaFascia: number; capacitaConsegne: number; anticipoMinuti: number; telefono: string | null; apertiIl: string | null }
export interface Zona { id: string; nome: string; costoCent: number; minimoCent: number; attiva: boolean; posizione: number }
export type DatiZona = Omit<Zona,'id'>
export interface Orario extends Turno { id: string; servizio: Servizio; giorno: number }
export interface Chiusura { data: string; motivo: string | null }
// date e time arrivano come testo: il driver pg trasformerebbe una date in un Date a mezzanotte locale.
export async function leggiImpostazioni(db: Db): Promise<ImpostazioniCasa> {
  const [i] = await db.query<ImpostazioniCasa>(`select capacita_fascia as "capacitaFascia",capacita_consegne as "capacitaConsegne",anticipo_minuti as "anticipoMinuti",telefono,aperti_il::text as "apertiIl" from impostazioni_casa where id=1`)
  return i
}
export async function salvaImpostazioni(db: Db, i: Omit<ImpostazioniCasa,'apertiIl'>): Promise<void> {
  await db.query('update impostazioni_casa set capacita_fascia=$1,capacita_consegne=$2,anticipo_minuti=$3,telefono=$4 where id=1',[i.capacitaFascia,i.capacitaConsegne,i.anticipoMinuti,i.telefono])
}
/** `data` = giorno (a Roma) in cui gli ordini online sono aperti, oppure null per chiuderli. */
export async function impostaApertura(db: Db, data: string | null): Promise<void> {
  await db.query('update impostazioni_casa set aperti_il=$1::date where id=1',[data])
}
const COLONNE_ZONA = `id,nome,costo_cent as "costoCent",minimo_cent as "minimoCent",attiva,posizione`
export async function elencoZone(db: Db, soloAttive = false): Promise<Zona[]> {
  return db.query<Zona>(`select ${COLONNE_ZONA} from zone_consegna ${soloAttive ? 'where attiva' : ''} order by posizione,nome`)
}
export async function zonaPerId(db: Db, id: string): Promise<Zona | null> {
  if (!idValido(id)) return null
  return (await db.query<Zona>(`select ${COLONNE_ZONA} from zone_consegna where id=$1`,[id]))[0] ?? null
}
export async function creaZona(db: Db, z: DatiZona): Promise<Zona> {
  return (await db.query<Zona>(`insert into zone_consegna (nome,costo_cent,minimo_cent,attiva,posizione) values ($1,$2,$3,$4,$5) returning ${COLONNE_ZONA}`,[z.nome,z.costoCent,z.minimoCent,z.attiva,z.posizione]))[0]
}
export async function salvaZona(db: Db, id: string, z: DatiZona): Promise<boolean> {
  if (!idValido(id)) return false
  return (await db.query('update zone_consegna set nome=$2,costo_cent=$3,minimo_cent=$4,attiva=$5,posizione=$6 where id=$1 returning id',[id,z.nome,z.costoCent,z.minimoCent,z.attiva,z.posizione])).length === 1
}
const COLONNE_ORARIO = `id,servizio,giorno,to_char(dalle,'HH24:MI') as dalle,to_char(alle,'HH24:MI') as alle`
export async function elencoOrari(db: Db): Promise<Orario[]> {
  return db.query<Orario>(`select ${COLONNE_ORARIO} from orari_casa order by giorno,servizio,dalle`)
}
export async function turniDelGiorno(db: Db, servizio: Servizio, giorno: number): Promise<Turno[]> {
  return db.query<Turno>(`select to_char(dalle,'HH24:MI') as dalle,to_char(alle,'HH24:MI') as alle from orari_casa where servizio=$1 and giorno=$2 order by dalle`,[servizio,giorno])
}
export async function aggiungiOrario(db: Db, o: Omit<Orario,'id'>): Promise<void> {
  await db.query('insert into orari_casa (servizio,giorno,dalle,alle) values ($1,$2,$3::time,$4::time)',[o.servizio,o.giorno,o.dalle,o.alle])
}
export async function rimuoviOrario(db: Db, id: string): Promise<boolean> {
  if (!idValido(id)) return false
  return (await db.query('delete from orari_casa where id=$1 returning id',[id])).length === 1
}
/** Chiusure da `daData` in poi (le passate non servono più). */
export async function elencoChiusure(db: Db, daData: string): Promise<Chiusura[]> {
  return db.query<Chiusura>('select data::text as data,motivo from chiusure_casa where data >= $1::date order by data',[daData])
}
export async function chiusoIl(db: Db, data: string): Promise<boolean> {
  return (await db.query('select 1 from chiusure_casa where data=$1::date',[data])).length === 1
}
export async function aggiungiChiusura(db: Db, data: string, motivo: string | null): Promise<void> {
  await db.query('insert into chiusure_casa (data,motivo) values ($1::date,$2) on conflict (data) do update set motivo=excluded.motivo',[data,motivo])
}
export async function rimuoviChiusura(db: Db, data: string): Promise<boolean> {
  return (await db.query('delete from chiusure_casa where data=$1::date returning data',[data])).length === 1
}
/** Vero se tutti i piatti disponibili hanno gli allergeni confermati. */
export async function allergeniCompleti(db: Db): Promise<boolean> {
  const [r] = await db.query<{ completi: boolean }>('select not exists (select 1 from piatti where disponibile and not allergeni_confermati) as completi')
  return r.completi
}
```


**Crea** `src/casa/disponibilita.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import { fasceDelGiorno, fascePrenotabili, SERVIZI, type Occupazione, type RegoleFasce, type Servizio } from '@/domain/fasce'
import { aperturaServizio, type StatoApertura } from '@/domain/apertura-casa'
import { dataRoma, giornoSettimana, istanteRoma } from '@/domain/ora-roma'
import { STATI_ATTIVI_CASA } from '@/domain/stati-casa'
import { allergeniCompleti, chiusoIl, elencoZone, leggiImpostazioni, turniDelGiorno, type Zona } from './impostazioni-repo'
export interface DisponibilitaServizio { apertura: StatoApertura; fasce: string[] }
export interface DisponibilitaCasa {
  oggi: string; telefono: string | null; apertiIl: string | null; regole: RegoleFasce; zone: Zona[]
  servizi: Record<Servizio,DisponibilitaServizio>
}
/** Ordini attivi da casa per fascia, nel giorno `oggi` di Roma. */
export async function occupazioneFasce(db: Db, oggi: string): Promise<Occupazione[]> {
  const righe = await db.query<{ fascia: Date; totale: number; domicilio: number }>(`select fascia,count(*)::int as totale,count(*) filter (where tipo='domicilio')::int as domicilio
    from ordini where tipo<>'tavolo' and stato=any($1::text[]) and fascia >= $2 and fascia < $3 group by fascia`,[STATI_ATTIVI_CASA,istanteRoma(oggi,0),istanteRoma(oggi,24 * 60)])
  return righe.map(r => ({ fascia: new Date(r.fascia).toISOString(),totale: r.totale,domicilio: r.domicilio }))
}
/** Tutto quello che serve per sapere se e quando si può ordinare adesso. Da usare anche dentro la transazione d'invio. */
export async function leggiDisponibilita(db: Db, adesso: Date, prova: boolean): Promise<DisponibilitaCasa> {
  const oggi = dataRoma(adesso), giorno = giornoSettimana(oggi)
  const [impostazioni,completi,chiuso,zone,occupazione,turniAsporto,turniDomicilio] = [await leggiImpostazioni(db),await allergeniCompleti(db),await chiusoIl(db,oggi),
    await elencoZone(db,true),await occupazioneFasce(db,oggi),await turniDelGiorno(db,'asporto',giorno),await turniDelGiorno(db,'domicilio',giorno)]
  const regole: RegoleFasce = { capacitaFascia: impostazioni.capacitaFascia,capacitaConsegne: impostazioni.capacitaConsegne,anticipoMinuti: impostazioni.anticipoMinuti }
  const turni = { asporto: turniAsporto,domicilio: turniDomicilio }
  const servizi = Object.fromEntries(SERVIZI.map(s => {
    const fasce = fascePrenotabili(s,fasceDelGiorno(oggi,turni[s]),occupazione,regole,adesso).map(f => f.toISOString())
    const apertura = aperturaServizio(s,{ allergeniCompleti: completi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,oggi,chiusoOggi: chiuso,zoneAttive: zone.length,fasceLibere: fasce.length,prova })
    return [s,{ apertura,fasce: apertura.aperto ? fasce : [] }]
  })) as Record<Servizio,DisponibilitaServizio>
  return { oggi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,regole,zone,servizi }
}
```


- [x] **Step 4:** stesso comando → atteso **1 file, 6 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add src/casa && git commit -m "Impostazioni da casa: zone, orari, chiusure e disponibilità di oggi"`

---

### Task 6: Admin del domicilio

**File:**
- crea `src/domain/valida-domicilio.ts` (+test) e `src/app/admin/domicilio/` (`azioni.ts` +test, `ModuliDomicilio.tsx`, `page.tsx`);
- modifica `src/app/admin/layout.tsx` (voce «Domicilio») e `src/app/admin/admin.css`.

**Attenzione:** `GIORNI` sta in `src/domain/valida-domicilio.ts` e **non** in `ModuliDomicilio.tsx` (file `'use client'`). Vedi Global Constraints.

- [x] **Step 1: test**

**Crea** `src/domain/valida-domicilio.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { validaChiusura, validaImpostazioni, validaOrario, validaZona } from './valida-domicilio'
it('impostazioni: capacità, consegne non oltre il totale, anticipo e telefono facoltativo', () => {
  expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '080 123 4567' }))
    .toEqual({ ok: true,dati: { capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' } })
  expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '0',anticipoMinuti: '0',telefono: '' })).toMatchObject({ ok: true,dati: { telefono: null } })
  for (const v of [{ capacitaFascia: '0' },{ capacitaConsegne: '5' },{ anticipoMinuti: '300' },{ telefono: '12' },{ capacitaFascia: '2.5' }])
    expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '',...v }).ok).toBe(false)
})
it('zona: nome, importi in euro, posizione e casella attiva', () => {
  expect(validaZona({ nome: ' Bitetto ',costo: '2',minimo: '15,00',posizione: '1',attiva: 'on' })).toEqual({ ok: true,dati: { nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 1 } })
  expect(validaZona({ nome: 'Bitetto',costo: '0',minimo: '0' })).toMatchObject({ ok: true,dati: { attiva: false,posizione: 0 } })
  for (const v of [{ nome: '' },{ costo: '-1' },{ costo: '1001' },{ minimo: 'dieci' },{ posizione: 'primo' }])
    expect(validaZona({ nome: 'B',costo: '2',minimo: '15',posizione: '0',...v }).ok).toBe(false)
})
it('orario: servizio, giorno e inizio prima della fine', () => {
  expect(validaOrario({ servizio: 'domicilio',giorno: '5',dalle: '19:30',alle: '22:30' })).toEqual({ ok: true,dati: { servizio: 'domicilio',giorno: 5,dalle: '19:30',alle: '22:30' } })
  for (const v of [{ servizio: 'tavolo' },{ giorno: '8' },{ dalle: '23:00' },{ alle: '24:00' }])
    expect(validaOrario({ servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00',...v }).ok).toBe(false)
})
it('chiusura: data valida e motivo facoltativo', () => {
  expect(validaChiusura({ data: '2026-12-25',motivo: ' Natale ' })).toEqual({ ok: true,dati: { data: '2026-12-25',motivo: 'Natale' } })
  expect(validaChiusura({ data: '2026-12-25',motivo: '' })).toEqual({ ok: true,dati: { data: '2026-12-25',motivo: null } })
  expect(validaChiusura({ data: '2026-02-30' }).ok).toBe(false)
  expect(validaChiusura({ data: '2026-12-25',motivo: 'x'.repeat(101) }).ok).toBe(false)
})
```


**Crea** `src/app/admin/domicilio/azioni.test.ts` con:

```ts
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), revalidatePath: vi.fn(), salvaImpostazioni: vi.fn(), creaZona: vi.fn(), salvaZona: vi.fn(), aggiungiOrario: vi.fn(), rimuoviOrario: vi.fn(), aggiungiChiusura: vi.fn(), rimuoviChiusura: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/casa/impostazioni-repo', () => ({ salvaImpostazioni: m.salvaImpostazioni, creaZona: m.creaZona, salvaZona: m.salvaZona, aggiungiOrario: m.aggiungiOrario, rimuoviOrario: m.rimuoviOrario, aggiungiChiusura: m.aggiungiChiusura, rimuoviChiusura: m.rimuoviChiusura }))
import { aggiungiChiusuraCasa, aggiungiOrarioCasa, rimuoviChiusuraCasa, rimuoviOrarioCasa, salvaImpostazioniCasa, salvaZonaCasa, type StatoModulo } from './azioni'
const stato: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const id = '11111111-1111-4111-8111-111111111111'
const fd = (v: Record<string,string>) => { const f = new FormData(); for (const [k,x] of Object.entries(v)) f.set(k,x); f.set('$ACTION_ID_abc',''); return f }
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.salvaZona.mockResolvedValue(true); m.rimuoviOrario.mockResolvedValue(true); m.rimuoviChiusura.mockResolvedValue(true) })
it('impostazioni: admin prima del salvataggio, valori convertiti e pagine rivalidate', async () => {
  expect(await salvaImpostazioniCasa(stato,fd({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '080 1234567' }))).toEqual({ errore: null,salvato: true,valori: null,invii: 1 })
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.salvaImpostazioni.mock.invocationCallOrder[0])
  expect(m.salvaImpostazioni).toHaveBeenCalledWith({},{ capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' })
  expect(m.revalidatePath).toHaveBeenCalledWith('/admin/domicilio'); expect(m.revalidatePath).toHaveBeenCalledWith('/ordina')
})
it('un errore del controllo conserva i valori inseriti, senza le chiavi interne di Next', async () => {
  const s = await salvaImpostazioniCasa(stato,fd({ capacitaFascia: '4',capacitaConsegne: '9',anticipoMinuti: '30',telefono: '' }))
  expect(s).toMatchObject({ salvato: false,errore: expect.stringContaining('Consegne'),invii: 1 })
  expect(s.valori).toEqual({ capacitaFascia: '4',capacitaConsegne: '9',anticipoMinuti: '30',telefono: '' })
  expect(m.salvaImpostazioni).not.toHaveBeenCalled()
})
it('zone: crea senza id, modifica con id valido, rifiuta id non validi', async () => {
  const z = { nome: 'Bitetto',costo: '2',minimo: '15',posizione: '0',attiva: 'on' }
  expect((await salvaZonaCasa(null,stato,fd(z))).salvato).toBe(true); expect(m.creaZona).toHaveBeenCalled()
  expect((await salvaZonaCasa(id,stato,fd(z))).salvato).toBe(true); expect(m.salvaZona).toHaveBeenCalledWith({},id,expect.objectContaining({ nome: 'Bitetto' }))
  expect((await salvaZonaCasa('x',stato,fd(z))).salvato).toBe(false)
  m.salvaZona.mockResolvedValueOnce(false)
  expect((await salvaZonaCasa(id,stato,fd(z))).errore).toContain('Salvataggio non riuscito')
})
it('orari e chiusure: aggiunta e rimozione', async () => {
  expect((await aggiungiOrarioCasa(stato,fd({ servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00' }))).salvato).toBe(true)
  expect((await aggiungiChiusuraCasa(stato,fd({ data: '2026-12-25',motivo: 'Natale' }))).salvato).toBe(true)
  expect(m.aggiungiChiusura).toHaveBeenCalledWith({},'2026-12-25','Natale')
  expect(await rimuoviOrarioCasa(id)).toEqual({ ok: true })
  expect(await rimuoviOrarioCasa('x')).toMatchObject({ ok: false }); expect(m.rimuoviOrario).toHaveBeenCalledTimes(1)
  m.rimuoviChiusura.mockResolvedValueOnce(false)
  expect(await rimuoviChiusuraCasa('2026-12-25')).toMatchObject({ ok: false,errore: expect.stringContaining('Già rimosso') })
  expect(await rimuoviChiusuraCasa('domani')).toMatchObject({ ok: false })
})
it('redirect di ruolo propagati ed errori del DB in italiano', async () => {
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(salvaImpostazioniCasa(stato,fd({}))).rejects.toThrow('NEXT_REDIRECT')
  await expect(rimuoviOrarioCasa(id)).rejects.toThrow('NEXT_REDIRECT')
  m.richiediRuolo.mockResolvedValue(undefined)
  m.rimuoviOrario.mockRejectedValueOnce(new Error('connessione'))
  expect(await rimuoviOrarioCasa(id)).toEqual({ ok: false,errore: 'Operazione non riuscita, riprova.' })
})
```


- [x] **Step 2:** `npx vitest run src/domain/valida-domicilio.test.ts src/app/admin/domicilio` → atteso **FAIL**.
- [x] **Step 3: codice**

**Crea** `src/domain/valida-domicilio.ts` con:

```ts
import { minutiDa, servizioValido } from './fasce'
import { dataValida } from './ora-roma'
import { parseEuro } from './soldi'
import { normalizzaTelefono } from './checkout'
import type { ImpostazioniCasa, DatiZona, Orario, Chiusura } from '@/casa/impostazioni-repo'
type Esito<T> = { ok: true; dati: T } | { ok: false; errore: string }
/** Nomi dei giorni nell'ordine dei numeri usati negli orari (1 = lunedì). */
export const GIORNI = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'] as const
const intero = (v: string | undefined, min: number, max: number): number | null => v !== undefined && /^\d{1,6}$/.test(v.trim()) && +v >= min && +v <= max ? +v : null
export function validaImpostazioni(v: Record<string,string>): Esito<Omit<ImpostazioniCasa,'apertiIl'>> {
  const capacitaFascia = intero(v.capacitaFascia,1,50), capacitaConsegne = intero(v.capacitaConsegne,0,50), anticipoMinuti = intero(v.anticipoMinuti,0,240)
  if (capacitaFascia === null) return { ok: false,errore: 'Ordini per fascia: un numero da 1 a 50.' }
  if (capacitaConsegne === null || capacitaConsegne > capacitaFascia) return { ok: false,errore: 'Consegne per fascia: un numero da 0 al totale degli ordini per fascia.' }
  if (anticipoMinuti === null) return { ok: false,errore: 'Anticipo minimo: da 0 a 240 minuti.' }
  const telefono = v.telefono?.trim() ? normalizzaTelefono(v.telefono) : null
  if (v.telefono?.trim() && !telefono) return { ok: false,errore: 'Scrivi un numero di telefono italiano valido.' }
  return { ok: true,dati: { capacitaFascia,capacitaConsegne,anticipoMinuti,telefono } }
}
export function validaZona(v: Record<string,string>): Esito<DatiZona> {
  const nome = v.nome?.trim() ?? ''
  if (nome.length < 1 || nome.length > 60) return { ok: false,errore: 'Il nome della zona va da 1 a 60 caratteri.' }
  const costoCent = parseEuro(v.costo ?? ''), minimoCent = parseEuro(v.minimo ?? '')
  if (costoCent === null || costoCent > 100000) return { ok: false,errore: 'Costo di consegna non valido.' }
  if (minimoCent === null) return { ok: false,errore: 'Ordine minimo non valido.' }
  const posizione = intero(v.posizione ?? '0',0,999)
  if (posizione === null) return { ok: false,errore: 'Posizione: un numero da 0 a 999.' }
  return { ok: true,dati: { nome,costoCent,minimoCent,attiva: v.attiva === 'on',posizione } }
}
export function validaOrario(v: Record<string,string>): Esito<Omit<Orario,'id'>> {
  const giorno = intero(v.giorno,1,7), dalle = minutiDa(v.dalle), alle = minutiDa(v.alle)
  if (!servizioValido(v.servizio)) return { ok: false,errore: 'Scegli asporto o domicilio.' }
  if (giorno === null) return { ok: false,errore: 'Scegli il giorno.' }
  if (dalle === null || alle === null || dalle >= alle) return { ok: false,errore: 'L’orario d’inizio deve venire prima della fine, nello stesso giorno.' }
  return { ok: true,dati: { servizio: v.servizio,giorno,dalle: v.dalle.slice(0,5),alle: v.alle.slice(0,5) } }
}
export function validaChiusura(v: Record<string,string>): Esito<Chiusura> {
  if (!dataValida(v.data)) return { ok: false,errore: 'Scegli una data valida.' }
  const motivo = v.motivo?.trim() ?? ''
  if (motivo.length > 100) return { ok: false,errore: 'Il motivo può avere al massimo 100 caratteri.' }
  return { ok: true,dati: { data: v.data,motivo: motivo || null } }
}
```


**Crea** `src/app/admin/domicilio/azioni.ts` con:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { aggiungiChiusura, aggiungiOrario, creaZona, rimuoviChiusura, rimuoviOrario, salvaImpostazioni, salvaZona } from '@/casa/impostazioni-repo'
import { validaChiusura, validaImpostazioni, validaOrario, validaZona } from '@/domain/valida-domicilio'
import { dataValida } from '@/domain/ora-roma'
import { idValido } from '@/tavoli/validazione'
export interface StatoModulo { errore: string | null; salvato: boolean; valori: Record<string,string> | null; invii: number }
export interface EsitoAdmin { ok: boolean; errore?: string }
function valori(fd: FormData): Record<string,string> {
  return Object.fromEntries([...fd.entries()].filter((e): e is [string,string] => typeof e[1] === 'string' && !e[0].startsWith('$')))
}
function rivalida() {
  revalidatePath('/admin/domicilio'); revalidatePath('/'); revalidatePath('/ordina'); revalidatePath('/staff')
}
// Salva con un controllo puro: l'errore del controllo o del DB torna nel modulo con i valori inseriti.
async function salvaModulo<T>(stato: StatoModulo, fd: FormData, controlla: (v: Record<string,string>) => { ok: true; dati: T } | { ok: false; errore: string }, salva: (dati: T) => Promise<unknown>): Promise<StatoModulo> {
  const v = valori(fd), invii = stato.invii + 1
  const esito = controlla(v)
  if (!esito.ok) return { errore: esito.errore,salvato: false,valori: v,invii }
  try { await salva(esito.dati) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Salvataggio non riuscito: controlla la connessione e riprova.',salvato: false,valori: v,invii }
  }
  rivalida()
  return { errore: null,salvato: true,valori: null,invii }
}
export async function salvaImpostazioniCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaImpostazioni,dati => salvaImpostazioni(db,dati))
}
export async function salvaZonaCasa(id: string | null, stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  if (id !== null && !idValido(id)) return { errore: 'Zona non valida.',salvato: false,valori: null,invii: stato.invii + 1 }
  return salvaModulo(stato,fd,validaZona,async dati => {
    if (id === null) await creaZona(db,dati)
    else if (!await salvaZona(db,id,dati)) throw new Error('zona non trovata')
  })
}
export async function aggiungiOrarioCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaOrario,dati => aggiungiOrario(db,dati))
}
export async function aggiungiChiusuraCasa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  return salvaModulo(stato,fd,validaChiusura,dati => aggiungiChiusura(db,dati.data,dati.motivo))
}
async function rimuovi(fn: () => Promise<boolean>): Promise<EsitoAdmin> {
  try { if (!await fn()) return { ok: false,errore: 'Già rimosso: aggiorna la pagina.' } } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  rivalida()
  return { ok: true }
}
export async function rimuoviOrarioCasa(id: string): Promise<EsitoAdmin> {
  await richiediRuolo('admin')
  if (!idValido(id)) return { ok: false,errore: 'Orario non valido.' }
  return rimuovi(() => rimuoviOrario(db,id))
}
export async function rimuoviChiusuraCasa(data: string): Promise<EsitoAdmin> {
  await richiediRuolo('admin')
  if (!dataValida(data)) return { ok: false,errore: 'Data non valida.' }
  return rimuovi(() => rimuoviChiusura(db,data))
}
```


**Crea** `src/app/admin/domicilio/ModuliDomicilio.tsx` con:

```tsx
'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro } from '@/domain/soldi'
import type { ImpostazioniCasa, Zona } from '@/casa/impostazioni-repo'
import { GIORNI } from '@/domain/valida-domicilio'
import { aggiungiChiusuraCasa, aggiungiOrarioCasa, salvaImpostazioniCasa, salvaZonaCasa, type EsitoAdmin, type StatoModulo } from './azioni'
const INIZIALE: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const euro = (cent: number) => formatEuro(cent).replace(/\s*€$/,'')
function Esito({ stato }: { stato: StatoModulo }) {
  return <>{stato.errore && <p role="alert">{stato.errore}</p>}{stato.salvato && <p role="status">Salvato.</p>}</>
}
export function ModuloImpostazioni({ impostazioni: i }: { impostazioni: ImpostazioniCasa }) {
  const [stato,azione,inCorso] = useActionState(salvaImpostazioniCasa,INIZIALE)
  const v = stato.valori ?? { capacitaFascia: String(i.capacitaFascia),capacitaConsegne: String(i.capacitaConsegne),anticipoMinuti: String(i.anticipoMinuti),telefono: i.telefono ?? '' }
  return <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
    <label className="campo">Ordini da casa per fascia di 15 minuti<input type="number" name="capacitaFascia" min={1} max={50} required defaultValue={v.capacitaFascia} /></label>
    <label className="campo">Di questi, al massimo a domicilio<input type="number" name="capacitaConsegne" min={0} max={50} required defaultValue={v.capacitaConsegne} /></label>
    <label className="campo">Anticipo minimo (minuti)<input type="number" name="anticipoMinuti" min={0} max={240} required defaultValue={v.anticipoMinuti} /></label>
    <label className="campo">Telefono del locale (mostrato ai clienti)<input type="tel" name="telefono" maxLength={20} defaultValue={v.telefono} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva impostazioni'}</button>
  </form>
}
export function ModuloZona({ zona }: { zona?: Zona }) {
  const [stato,azione,inCorso] = useActionState(salvaZonaCasa.bind(null,zona?.id ?? null),INIZIALE)
  const v = stato.valori ?? { nome: zona?.nome ?? '',costo: zona ? euro(zona.costoCent) : '',minimo: zona ? euro(zona.minimoCent) : '',posizione: String(zona?.posizione ?? 0),attiva: zona && !zona.attiva ? '' : 'on' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">{zona ? zona.nome : 'Aggiungi zona'}</h3>
    <label className="campo">Nome<input name="nome" required maxLength={60} defaultValue={v.nome} /></label>
    <label className="campo">Costo di consegna (€)<input name="costo" inputMode="decimal" required defaultValue={v.costo} /></label>
    <label className="campo">Ordine minimo (€)<input name="minimo" inputMode="decimal" required defaultValue={v.minimo} /></label>
    <label className="campo">Posizione<input type="number" name="posizione" min={0} max={999} required defaultValue={v.posizione} /></label>
    <label className="admin-tavolo-check"><input type="checkbox" name="attiva" defaultChecked={v.attiva === 'on'} />Attiva</label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : zona ? 'Salva zona' : 'Aggiungi zona'}</button>
  </form>
}
export function ModuloOrario() {
  const [stato,azione,inCorso] = useActionState(aggiungiOrarioCasa,INIZIALE)
  const v = stato.valori ?? { servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">Aggiungi turno</h3>
    <label className="campo">Servizio<select name="servizio" defaultValue={v.servizio}><option value="asporto">Asporto</option><option value="domicilio">Domicilio</option></select></label>
    <label className="campo">Giorno<select name="giorno" defaultValue={v.giorno}>{GIORNI.map((g,i) => <option key={g} value={i + 1}>{g}</option>)}</select></label>
    <label className="campo">Dalle<input type="time" name="dalle" step={900} required defaultValue={v.dalle} /></label>
    <label className="campo">Alle<input type="time" name="alle" step={900} required defaultValue={v.alle} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Aggiungi turno'}</button>
  </form>
}
export function ModuloChiusura() {
  const [stato,azione,inCorso] = useActionState(aggiungiChiusuraCasa,INIZIALE)
  const v = stato.valori ?? { data: '',motivo: '' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">Aggiungi chiusura</h3>
    <label className="campo">Data<input type="date" name="data" required defaultValue={v.data} /></label>
    <label className="campo">Motivo (facoltativo)<input name="motivo" maxLength={100} defaultValue={v.motivo} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Aggiungi chiusura'}</button>
  </form>
}
export function BottoneRimuovi({ etichetta,rimuovi }: { etichetta: string; rimuovi: () => Promise<EsitoAdmin> }) {
  const [inCorso,start] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  return <>
    <button type="button" className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso} onClick={() => start(async () => {
      setErrore(null)
      try { const e = await rimuovi(); if (!e.ok) setErrore(e.errore ?? 'Operazione non riuscita.'); router.refresh() }
      catch { setErrore('Operazione non riuscita, riprova.') }
    })}>Rimuovi<span className="visually-hidden"> {etichetta}</span></button>
    {errore && <span role="alert"> {errore}</span>}
  </>
}
```


**Crea** `src/app/admin/domicilio/page.tsx` con:

```tsx
import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { allergeniCompleti, elencoChiusure, elencoOrari, elencoZone, leggiImpostazioni } from '@/casa/impostazioni-repo'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { pokeOrdinabile } from '@/domain/poke'
import { dataRoma } from '@/domain/ora-roma'
import { GIORNI } from '@/domain/valida-domicilio'
import { BottoneRimuovi, ModuloChiusura, ModuloImpostazioni, ModuloOrario, ModuloZona } from './ModuliDomicilio'
import { rimuoviChiusuraCasa, rimuoviOrarioCasa } from './azioni'
export default async function DomicilioAdmin() {
  await richiediRuolo('admin')
  const oggi = dataRoma(new Date())
  const [impostazioni,zone,orari,chiusure,completi,config] = [await leggiImpostazioni(db),await elencoZone(db),await elencoOrari(db),await elencoChiusure(db,oggi),await allergeniCompleti(db),await leggiPokeConfig(db)]
  const poke = config && pokeOrdinabile(config) ? await leggiAllergeniPoke(db,config) : null
  return <>
    <h1 className="heading">Domicilio e asporto</h1>
    <p>Gli ordini da casa arrivano solo quando lo staff li apre dallo schermo staff, negli orari qui sotto e per il giorno stesso.</p>
    {!completi && <p className="admin-avviso">Ci sono piatti disponibili con allergeni da confermare: gli ordini da casa restano chiusi finché non li confermi nel <Link className="ds-link" href="/admin/menu">menù</Link>.</p>}
    {poke && !poke.confermati && <p className="admin-avviso">La poke composta non si può ordinare da casa finché non confermi gli <Link className="ds-link" href="/admin/poke">allergeni degli ingredienti</Link>.</p>}
    {!impostazioni.telefono && <p className="admin-avviso">Imposta il telefono del locale: senza, gli ordini online non si aprono.</p>}
    <section><h2 className="heading">Impostazioni</h2><ModuloImpostazioni impostazioni={impostazioni} /></section>
    <section><h2 className="heading">Zone di consegna</h2><p>Le zone non si cancellano: disattivale. Gli ordini già fatti conservano nome e costo.</p>
      <div className="admin-tavoli">{zone.map(z => <ModuloZona key={z.id} zona={z} />)}<ModuloZona /></div></section>
    <section><h2 className="heading">Orari</h2><p>Turni di asporto e domicilio per ogni giorno. Le fasce iniziano ogni 15 minuti, dall’inizio del turno fino a 15 minuti prima della fine.</p>
      <div className="admin-tavoli">{GIORNI.map((nome,i) => <article key={nome} className="admin-tavolo ds-card"><h3 className="heading-sm">{nome}</h3>
        {(['asporto','domicilio'] as const).map(s => { const turni = orari.filter(o => o.giorno === i + 1 && o.servizio === s)
          return <div key={s}><p><strong>{s === 'asporto' ? 'Asporto' : 'Domicilio'}</strong>{!turni.length && ': nessun turno'}</p>
            <ul className="admin-turni">{turni.map(o => <li key={o.id}>{o.dalle}–{o.alle}<BottoneRimuovi etichetta={`${s} ${nome} ${o.dalle}`} rimuovi={rimuoviOrarioCasa.bind(null,o.id)} /></li>)}</ul></div> })}
      </article>)}<ModuloOrario /></div></section>
    <section><h2 className="heading">Chiusure straordinarie</h2>{!chiusure.length && <p>Nessuna chiusura in programma.</p>}
      <ul className="admin-turni">{chiusure.map(c => <li key={c.data}>{new Date(`${c.data}T12:00:00Z`).toLocaleDateString('it-IT',{ weekday: 'long',day: 'numeric',month: 'long',year: 'numeric',timeZone: 'Europe/Rome' })}{c.motivo && ` · ${c.motivo}`}
        <BottoneRimuovi etichetta={c.data} rimuovi={rimuoviChiusuraCasa.bind(null,c.data)} /></li>)}</ul>
      <ModuloChiusura /></section>
  </>
}
```


**Sostituisci tutto il contenuto** di `src/app/admin/layout.tsx` con:

```tsx
import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import './admin.css'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await richiediRuolo('admin')
  return (
    <div className="admin">
      <header className="admin__barra">
        <strong className="heading-sm">Gestionale</strong>
        <nav className="admin__nav">
          <Link href="/admin/menu" className="ds-link">Menù</Link>
          <Link href="/admin/tavoli" className="ds-link">Tavoli</Link>
          <Link href="/admin/poke" className="ds-link">Poke</Link>
          <Link href="/admin/domicilio" className="ds-link">Domicilio</Link>
          <Link href="/staff" className="ds-link">Schermo staff</Link>
          <Link href="/" className="ds-link">Vedi il menù pubblico</Link>
        </nav>
        <form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form>
      </header>
      <main className="contenitore admin__contenuto">{children}</main>
    </div>
  )
}
```


**Modifica** `src/app/admin/admin.css`: sostituisci

```css
@media (max-width: 40rem) { .admin-poke-regole { grid-template-columns: minmax(0, 1fr); } .admin-modulo-piatto { padding: 16px; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .admin__barra { background: var(--bg-elevated); } }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .admin__barra { background: var(--bg-elevated); -webkit-backdrop-filter: none; backdrop-filter: none; } }
```

con

```css
@media (max-width: 40rem) { .admin-poke-regole { grid-template-columns: minmax(0, 1fr); } .admin-modulo-piatto { padding: 16px; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .admin__barra { background: var(--bg-elevated); } }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .admin__barra { background: var(--bg-elevated); -webkit-backdrop-filter: none; backdrop-filter: none; } }
.admin-turni { display: grid; gap: var(--sp-8); padding: 0; margin: 0; list-style: none; }
.admin-turni li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-8); overflow-wrap: anywhere; }
.admin-tavolo select, .admin-tavolo input[type=time], .admin-tavolo input[type=date] { min-width: 0; width: 100%; }
```


- [x] **Step 4:** stesso comando → atteso **2 file, 9 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add src/domain/valida-domicilio.ts src/domain/valida-domicilio.test.ts src/app/admin/domicilio src/app/admin/layout.tsx src/app/admin/admin.css && git commit -m "Admin: impostazioni, zone, orari e chiusure del domicilio"`

---

### Task 7: Carrello, card dei piatti e composer condivisi tra tavolo e casa

**File:**
- sposta `Carrello.tsx` e `ComponiPoke.tsx` da `src/app/tavolo/[chiave]/` a `src/ordinare/`;
- crea `src/ordinare/CardPiatto.tsx`, `SezioniMenu.tsx`, `useCarrelloSalvato.ts` e `vista-carrello.ts` (+test);
- sostituisci `src/app/tavolo/[chiave]/MenuOrdinabile.tsx` e `src/app/tavolo/[chiave]/componenti.test.tsx`.

Il comportamento del tavolo **non cambia**: chiave `carrello_<sessione>` in `sessionStorage`, stessi messaggi, stesso invio.

**Interfacce prodotte:**
- `CardPiatto`;
- `Carrello` con prop facoltativa `azione` (default `'Invia ordine'`);
- `ComponiPoke` con prop facoltativa `allergeni`;
- `SezioniMenu({ categorie,quantita,modifica,pokeCard })`;
- `useCarrelloSalvato(chiave,'session'|'local')` → `{ carrello,ref,caricato,bloccato,imposta,modificaRighe,modificaPiatto,aggiungiPoke,svuota }`. Il Task 10 aggiungerà `blocca`/`sblocca`;
- `vistaCarrello(righe,piatti,config): RigaVista[]`, `totaleVista(righe)`.

- [x] **Step 1: sposta i file** (le modifiche ai file spostati sono nello Step 3):

```bash
mkdir -p src/ordinare
git mv "src/app/tavolo/[chiave]/Carrello.tsx" "src/ordinare/Carrello.tsx"
git mv "src/app/tavolo/[chiave]/ComponiPoke.tsx" "src/ordinare/ComponiPoke.tsx"
```

- [x] **Step 2: test**

**Crea** `src/ordinare/vista-carrello.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { totaleVista, vistaCarrello } from './vista-carrello'
import type { Piatto } from '@/menu/repo'
const piatto: Piatto = { id: '11111111-1111-4111-8111-111111111111',categoriaId: 'c',numero: 1,nome: 'Salmone',descrizione: null,prezzoCent: 600,piccante: false,vegetariano: false,dellaCasa: false,allergeni: [],allergeniConfermati: true,disponibile: true,posizione: 0 }
const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
it('nomi e prezzi stimati, piatti spariti e poke da ricomporre', () => {
  const righe = [{ piattoId: piatto.id,quantita: 2,nota: '' },{ piattoId: '22222222-2222-4222-8222-222222222222',quantita: 1,nota: '' },{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] } },{ piattoId: null,quantita: 1,nota: '',poke: { Base: [] } }]
  const vista = vistaCarrello(righe,[piatto],config)
  expect(vista.map(r => [r.nome,r.prezzoCent,r.daRicomporre])).toEqual([['Salmone',600,false],['Piatto non più in menù',0,false],['Poke composta',900,false],['Poke composta',0,true]])
  expect(totaleVista(vista)).toBe(2100)
  expect(vistaCarrello(righe.slice(2,3),[],null)[0]).toMatchObject({ daRicomporre: true,prezzoCent: 0 })
})
```


**Sostituisci tutto il contenuto** di `src/app/tavolo/[chiave]/componenti.test.tsx` con:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ inviaOrdine: vi.fn(), entraAlTavolo: vi.fn(), inizializzaDispositivo: vi.fn(), pulisciCookieTavolo: vi.fn() }))
import { OrdinatoFinora } from './OrdinatoFinora'
import { CardPiatto } from '@/ordinare/CardPiatto'
import { ModuloCodice } from './ModuloCodice'
import { Carrello } from '@/ordinare/Carrello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
it('il composer mostra gli allergeni solo quando sono passati, altrimenti rimanda al personale', () => {
  const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
  expect(renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} />)).toContain('chiedi al personale')
  const html = renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} allergeni={{ Base: { Riso: ['sesamo'] } }} />)
  expect(html).toContain('Allergeni della tua poke: nessuno dei 14 allergeni'); expect(html).not.toContain('chiedi al personale')
})
it('il carrello da casa porta al riepilogo invece di inviare', () => {
  const html = renderToStaticMarkup(<Carrello righe={[]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} azione="Vai al riepilogo" />)
  expect(html).toContain('Vai al riepilogo'); expect(html).not.toContain('Invia ordine')
})
import type { OrdineClient } from '@/tavoli/ordini-repo'
import type { Piatto } from '@/menu/repo'
it('ordini: stato, note, riga barrata e totale senza ordini annullati', () => {
  const o: OrdineClient = { id: 'o', numero: 1, stato: 'in_preparazione', totaleCent: 600, creatoIl: '2026-10-11T18:00:00Z', sessioneId: 's', tavoloNome: 'Uno',tavoloChiuso: false, righe: [{ id: 'r', numero: 1, nome: 'Salmone', prezzoUnitCent: 600, quantita: 1, nota: 'senza sesamo', poke: null, annullata: false }, { id: 'r2', numero: 2, nome: 'Tonno', prezzoUnitCent: 700, quantita: 1, nota: null, poke: null, annullata: true }] }
  const html = renderToStaticMarkup(<OrdinatoFinora ordini={[o,{ ...o,id: 'o2',numero: 2,stato: 'annullato',totaleCent: 600 }]} />)
  expect(html).toContain('In preparazione'); expect(html).toContain('senza sesamo'); expect(html).toContain('<s>'); expect(html).toContain('annullato'); expect(html).toContain('Totale finora'); expect(html).toContain('6,00\u00a0€'); expect(html).not.toContain('12,00')
})
it('piatto esaurito mostra allergeni e nessun bottone Aggiungi', () => {
  const p: Piatto = { id: 'p', categoriaId: 'x', numero: 1, nome: 'Salmone', descrizione: null, prezzoCent: 600, piccante: false, vegetariano: false, dellaCasa: false, allergeni: ['pesce'], allergeniConfermati: true, disponibile: false, posizione: 0 }
  const html = renderToStaticMarkup(<CardPiatto piatto={p} quantita={0} modifica={() => {}} />)
  expect(html).toContain('Esaurito'); expect(html).toContain('Allergeni: Pesce'); expect(html).not.toContain('Aggiungi')
})
it('il saluto «tavolo chiuso» sparisce se il tavolo è stato riaperto', () => {
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso />)).toContain('Il tavolo è chiuso')
  expect(renderToStaticMarkup(<ModuloCodice chiave="abcdefghijkl" chiuso tavoloAperto />)).not.toContain('Il tavolo è chiuso')
})
it('una poke da ricomporre non mostra un prezzo e il totale lo dice', () => {
  const html = renderToStaticMarkup(<Carrello righe={[{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] },nome: 'Poke composta',prezzoCent: 0,daRicomporre: true }]} modifica={() => {}} nota={() => {}} invia={async () => false} inCorso={false} errore={null} />)
  expect(html).toContain('Poke composta · —'); expect(html).toContain('senza le poke da ricomporre'); expect(html).not.toContain('Poke composta · 0,00')
})
```


- [x] **Step 3: codice** (per i due file spostati salta il `git mv` già fatto nello Step 1 e applica solo le modifiche):

**Sposta** `src/app/tavolo/[chiave]/Carrello.tsx` in `src/ordinare/Carrello.tsx`: `git mv "src/app/tavolo/[chiave]/Carrello.tsx" "src/ordinare/Carrello.tsx"`. Poi, nel file spostato:

**Modifica** `src/ordinare/Carrello.tsx` (1 di 2): sostituisci

```tsx
'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import type { RigaCarrello } from '@/domain/carrello'
import { Pannello } from '@/componenti/Pannello'
export interface RigaVista extends RigaCarrello { nome: string; prezzoCent: number; daRicomporre?: boolean }
export function Carrello({ righe,modifica,nota,invia,inCorso,errore }: { righe: RigaVista[]; modifica: (i: number,q: number) => void; nota: (i: number,testo: string) => void; invia: () => Promise<boolean>; inCorso: boolean; errore: string | null }) {
  const [aperto,setAperto] = useState(false)
  const totale = righe.reduce((s,r) => s + r.prezzoCent * r.quantita,0)
  const quantita = righe.reduce((s,r) => s + r.quantita,0)
```

con

```tsx
'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { Pannello } from '@/componenti/Pannello'
import type { RigaVista } from './vista-carrello'
// `azione`: testo del bottone pieno (al tavolo invia, da casa porta al riepilogo).
export function Carrello({ righe,modifica,nota,invia,inCorso,errore,azione = 'Invia ordine' }: { righe: RigaVista[]; modifica: (i: number,q: number) => void; nota: (i: number,testo: string) => void; invia: () => Promise<boolean>; inCorso: boolean; errore: string | null; azione?: string }) {
  const [aperto,setAperto] = useState(false)
  const totale = righe.reduce((s,r) => s + r.prezzoCent * r.quantita,0)
  const quantita = righe.reduce((s,r) => s + r.quantita,0)
```

**Modifica** `src/ordinare/Carrello.tsx` (2 di 2): sostituisci

```tsx
      </div>)}
      <p>Totale stimato: <strong>{formatEuro(totale)}</strong>{righe.some(r => r.daRicomporre) && ' (senza le poke da ricomporre)'}. Il prezzo viene verificato all’invio.</p>
      {errore && <p role="alert">{errore}</p>}
      <button type="button" className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso || !righe.length || righe.some(r => r.daRicomporre)} onClick={async () => { if (await invia()) setAperto(false) }}>{inCorso ? 'Invio in corso…' : 'Invia ordine'}</button>
    </Pannello>
  </>
}
```

con

```tsx
      </div>)}
      <p>Totale stimato: <strong>{formatEuro(totale)}</strong>{righe.some(r => r.daRicomporre) && ' (senza le poke da ricomporre)'}. Il prezzo viene verificato all’invio.</p>
      {errore && <p role="alert">{errore}</p>}
      <button type="button" className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso || !righe.length || righe.some(r => r.daRicomporre)} onClick={async () => { if (await invia()) setAperto(false) }}>{inCorso ? 'Invio in corso…' : azione}</button>
    </Pannello>
  </>
}
```


**Sposta** `src/app/tavolo/[chiave]/ComponiPoke.tsx` in `src/ordinare/ComponiPoke.tsx`: `git mv "src/app/tavolo/[chiave]/ComponiPoke.tsx" "src/ordinare/ComponiPoke.tsx"`. Poi, nel file spostato:

**Modifica** `src/ordinare/ComponiPoke.tsx`: sostituisci

```tsx
import type { PokeConfig } from '@/menu/importa'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
export function ComponiPoke({ config,aggiungi }: { config: PokeConfig; aggiungi: (scelte: SceltePoke) => void }) {
  const [scelte,setScelte] = useState<SceltePoke>({})
  const esito = validaPoke(config,scelte)
  const extra = config.gruppi.reduce((s,g) => s + Math.max(0,(scelte[g.nome]?.length ?? 0) - g.inclusi),0)
  return <div className="tavolo-poke">
    <p>Gli allergeni della poke dipendono dagli ingredienti: chiedi al personale prima di ordinare.</p>
    {config.gruppi.map(g => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend><p>{scelte[g.nome]?.length ?? 0} di {g.max} ({g.inclusi} incluse) · minimo {g.min}</p>
      {g.voci.map(v => <label className="tavolo-scelta" key={v}><input type={g.max === 1 ? 'radio' : 'checkbox'} name={`poke-${g.nome}`} checked={scelte[g.nome]?.includes(v) ?? false}
```

con

```tsx
import type { PokeConfig } from '@/menu/importa'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
import { etichettaAllergene } from '@/domain/allergeni'
import { allergeniScelte, type AllergeniVoci } from '@/domain/allergeni-poke'
// Con `allergeni` (confermati dall'admin) mostra quelli della poke scelta; senza, rimanda al personale.
export function ComponiPoke({ config,aggiungi,allergeni }: { config: PokeConfig; aggiungi: (scelte: SceltePoke) => void; allergeni?: AllergeniVoci }) {
  const [scelte,setScelte] = useState<SceltePoke>({})
  const esito = validaPoke(config,scelte)
  const extra = config.gruppi.reduce((s,g) => s + Math.max(0,(scelte[g.nome]?.length ?? 0) - g.inclusi),0)
  const codici = allergeni ? allergeniScelte(allergeni,scelte) : []
  return <div className="tavolo-poke">
    {allergeni ? <p aria-live="polite">{codici.length ? `Allergeni della tua poke: ${codici.map(etichettaAllergene).join(', ')}` : 'Allergeni della tua poke: nessuno dei 14 allergeni'}</p>
      : <p>Gli allergeni della poke dipendono dagli ingredienti: chiedi al personale prima di ordinare.</p>}
    {config.gruppi.map(g => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend><p>{scelte[g.nome]?.length ?? 0} di {g.max} ({g.inclusi} incluse) · minimo {g.min}</p>
      {g.voci.map(v => <label className="tavolo-scelta" key={v}><input type={g.max === 1 ? 'radio' : 'checkbox'} name={`poke-${g.nome}`} checked={scelte[g.nome]?.includes(v) ?? false}
```


**Crea** `src/ordinare/vista-carrello.ts` con:

```ts
import type { RigaCarrello } from '@/domain/carrello'
import type { PokeConfig } from '@/menu/importa'
import type { Piatto } from '@/menu/repo'
import { pokeDaRicomporre } from '@/domain/carrello-salvato'
import { validaPoke } from '@/domain/poke'
export interface RigaVista extends RigaCarrello { nome: string; prezzoCent: number; daRicomporre?: boolean }
/** Nomi e prezzi stimati delle righe del carrello; il server ricalcola comunque tutto all'invio. */
export function vistaCarrello(righe: RigaCarrello[], piatti: Piatto[], config: PokeConfig | null): RigaVista[] {
  const invalidi = pokeDaRicomporre(righe,config)
  return righe.map((r,i) => {
    const p = piatti.find(p => p.id === r.piattoId)
    const poke = config && r.poke ? validaPoke(config,r.poke) : null
    return { ...r,daRicomporre: invalidi.includes(i),nome: r.piattoId === null ? 'Poke composta' : p?.nome ?? 'Piatto non più in menù',prezzoCent: p?.prezzoCent ?? (poke?.ok ? poke.prezzoCent : 0) }
  })
}
/** Somma stimata delle righe valide. */
export function totaleVista(righe: RigaVista[]): number {
  return righe.reduce((s,r) => s + (r.daRicomporre ? 0 : r.prezzoCent * r.quantita),0)
}
```


**Crea** `src/ordinare/useCarrelloSalvato.ts` con:

```ts
'use client'
import { useEffect, useRef, useState } from 'react'
import type { RigaCarrello } from '@/domain/carrello'
import type { SceltePoke } from '@/domain/poke'
import { aggiornaCarrello, ripristinaCarrello, type CarrelloSalvato } from '@/domain/carrello-salvato'
const VUOTO: CarrelloSalvato = { righe: [],chiaveInvio: null }
export const TROPPE_RIGHE = 'Puoi aggiungere al massimo 40 righe per ordine.'
/**
 * Carrello con chiave d'invio, salvato nel browser: `session` per il tavolo, `local` per gli ordini da casa.
 * Finché `bloccato.current` è vero (invio in corso) le modifiche vengono ignorate.
 */
export function useCarrelloSalvato(chiave: string, archivio: 'session' | 'local') {
  const [carrello,setCarrello] = useState<CarrelloSalvato>(VUOTO)
  const ref = useRef(carrello)
  const [caricato,setCaricato] = useState(false)
  const bloccato = useRef(false)
  const storage = () => archivio === 'local' ? localStorage : sessionStorage
  const imposta = (c: CarrelloSalvato) => {
    ref.current = c; setCarrello(c)
    try { storage().setItem(chiave,JSON.stringify(c)) } catch { /* Funziona anche in memoria. */ }
  }
  useEffect(() => {
    let iniziali = VUOTO
    try { iniziali = ripristinaCarrello((archivio === 'local' ? localStorage : sessionStorage).getItem(chiave) ?? '[]',() => crypto.randomUUID()); (archivio === 'local' ? localStorage : sessionStorage).setItem(chiave,JSON.stringify(iniziali)) } catch { /* Funziona anche solo in memoria. */ }
    ref.current = iniziali
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ripristino dello stato da storage esterno dopo l'hydration.
    setCarrello(iniziali)
    setCaricato(true)
  },[chiave,archivio])
  /** Applica una modifica alle righe; restituisce false se ignorata. */
  const modificaRighe = (fn: (r: RigaCarrello[]) => RigaCarrello[]): boolean => {
    if (bloccato.current || !caricato) return false
    imposta(aggiornaCarrello(ref.current,fn(ref.current.righe),() => crypto.randomUUID()))
    return true
  }
  /** Imposta la quantità di un piatto; restituisce un messaggio d'errore se non si può. */
  const modificaPiatto = (id: string, q: number): string | null => {
    const i = ref.current.righe.findIndex(r => r.piattoId === id)
    if (i === -1 && q > 0 && ref.current.righe.length >= 40) return TROPPE_RIGHE
    modificaRighe(r => q === 0 ? r.filter(v => v.piattoId !== id) : i === -1 ? [...r,{ piattoId: id,quantita: q,nota: '' }] : r.map((v,j) => j === i ? { ...v,quantita: q } : v))
    return null
  }
  const aggiungiPoke = (poke: SceltePoke): string | null => {
    if (ref.current.righe.length >= 40) return TROPPE_RIGHE
    modificaRighe(r => [...r,{ piattoId: null,quantita: 1,nota: '',poke }])
    return null
  }
  const svuota = () => imposta(VUOTO)
  return { carrello,ref,caricato,bloccato,imposta,modificaRighe,modificaPiatto,aggiungiPoke,svuota }
}
```


**Crea** `src/ordinare/CardPiatto.tsx` con:

```tsx
import type { Piatto } from '@/menu/repo'
import { testoAllergeni } from '@/menu/testo-allergeni'
import { formatEuro } from '@/domain/soldi'
export function CardPiatto({ piatto: p,quantita,modifica }: { piatto: Piatto; quantita: number; modifica: (q: number) => void }) {
  return <article className={p.disponibile ? 'dish' : 'dish dish--esaurito'}>
    <span className="dish__num">{p.numero ?? ''}</span><h3 className="dish__name">{p.nome}</h3><span className="dish__price">{formatEuro(p.prezzoCent)}</span>
    {p.descrizione && <p className="dish__desc">{p.descrizione}</p>}
    <div className="dish__tags">{p.dellaCasa && <span className="ds-badge ds-badge--new">Della casa</span>}{p.piccante && <span className="ds-badge ds-badge--spicy">Piccante</span>}{p.vegetariano && <span className="ds-badge ds-badge--veg">Vegetariano</span>}{!p.disponibile && <span className="ds-badge">Esaurito</span>}</div>
    <p className="dish__allergeni">{testoAllergeni(p)}</p>
    {p.disponibile && <div className="tavolo-dish-azioni">{quantita ? <div className="tavolo-quantita"><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Riduci ${p.nome}`} onClick={() => modifica(quantita-1)}>−</button><span aria-live="polite">{quantita}</span><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Aumenta ${p.nome}`} disabled={quantita >= 20} onClick={() => modifica(quantita+1)}>+</button></div> : <button className="ds-btn ds-btn--secondary" type="button" onClick={() => modifica(1)}>Aggiungi<span className="visually-hidden"> {p.nome}</span></button>}</div>}
  </article>
}
```


**Crea** `src/ordinare/SezioniMenu.tsx` con:

```tsx
import type { CategoriaConPiatti } from '@/menu/repo'
import { CardPiatto } from './CardPiatto'
/** Categorie del menù con i piatti ordinabili; `pokeCard` compare in fondo alla categoria delle poke. */
export function SezioniMenu({ categorie,quantita,modifica,pokeCard }: { categorie: CategoriaConPiatti[]; quantita: (id: string) => number; modifica: (id: string,q: number) => void; pokeCard?: React.ReactNode }) {
  return <>
    <nav className="menu-nav" aria-label="Categorie del menù"><div className="ds-cats">{categorie.map(c => <a key={c.id} className="ds-chip" href={`#${c.id}`}>{c.nome}</a>)}</div></nav>
    {categorie.map(c => <section key={c.id} id={c.id} className="menu-cat" aria-labelledby={`${c.id}-titolo`}><div className="menu-cat__head"><h2 id={`${c.id}-titolo`}>{c.nome}</h2>{c.pezzi && <span className="menu-cat__note">{c.pezzi}</span>}</div><div className="dishes">{c.piatti.map(p => <CardPiatto key={p.id} piatto={p} quantita={quantita(p.id)} modifica={q => modifica(p.id,q)} />)}</div>
      {c.id === 'poke-bowl' && pokeCard}
    </section>)}
  </>
}
```


**Sostituisci tutto il contenuto** di `src/app/tavolo/[chiave]/MenuOrdinabile.tsx` con:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { formatEuro } from '@/domain/soldi'
import { aggiornaCarrello, pokeDaRicomporre } from '@/domain/carrello-salvato'
import { pokeOrdinabile, type SceltePoke } from '@/domain/poke'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import { inviaOrdine } from './azioni'

export function MenuOrdinabile({ categorie,config,sessioneId,chiave }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string; chiave: string }) {
  const c = useCarrelloSalvato(`carrello_${sessioneId}`,'session')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  const [messaggio,setMessaggio] = useState<string | null>(null)
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const modificaRighe: typeof c.modificaRighe = fn => { const fatto = c.modificaRighe(fn); if (fatto) setMessaggio(null); return fatto }
  const modificaPiatto = (id: string,q: number) => {
    if (c.bloccato.current || !c.caricato) return
    setMessaggio(null)
    const e = c.modificaPiatto(id,q)
    if (e) setErrore(e)
  }
  const aggiungiPoke = (poke: SceltePoke) => {
    if (c.bloccato.current || !c.caricato) return
    setMessaggio(null)
    const e = c.aggiungiPoke(poke)
    if (e) setErrore(e); else setPokeAperta(false)
  }
  const invia = () => new Promise<boolean>(risolvi => {
    if (c.bloccato.current || !c.caricato || !c.ref.current.chiaveInvio) { risolvi(false); return }
    if (pokeDaRicomporre(c.ref.current.righe,config).length) { setErrore('Questa poke va ricomposta: rimuovila e aggiungila di nuovo.'); risolvi(false); return }
    c.bloccato.current = true; setErrore(null); setMessaggio(null)
    startTransition(async () => {
      try {
        const esito = await inviaOrdine(chiave,JSON.stringify(c.ref.current.righe),c.ref.current.chiaveInvio!)
        if (esito.ok) { c.svuota(); setMessaggio(`Ordine n. ${esito.numero} inviato in cucina`); router.refresh(); risolvi(true) }
        else {
          setErrore(`${esito.errore ?? 'Invio non riuscito.'}${esito.nonDisponibili?.length ? `: ${esito.nonDisponibili.join(', ')}` : ''}`)
          if (esito.nonDisponibiliIds) c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(v => v.piattoId === null || !esito.nonDisponibiliIds!.includes(v.piattoId)),() => crypto.randomUUID()))
          risolvi(false); router.refresh()
        }
      } catch { setErrore('Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'); risolvi(false) }
      finally { c.bloccato.current = false }
    })
  })
  const ordinabile = config && pokeOrdinabile(config)
  return <>
    {messaggio && <div className="tavolo-avviso"><p role="status">{messaggio}</p><button type="button" className="ds-btn ds-btn--secondary" onClick={() => setMessaggio(null)}>Fine</button></div>}{errore && <p role="alert" className="tavolo-avviso">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={ordinabile && <div className="ds-card tavolo-poke-card"><h3 className="heading-sm">Componi la tua poke</h3><p>Da {formatEuro(config.prezzoBaseCent!)}, con ingredienti a tua scelta.</p><button className="ds-btn ds-btn--secondary" type="button" onClick={() => setPokeAperta(true)}>Componi la tua poke</button></div>} />
    {ordinabile && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke config={config} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,config)} modifica={(i,q) => modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))} nota={(i,nota) => modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={invia} inCorso={inCorso || !c.caricato} errore={errore} />
  </>
}
```


- [x] **Step 4:** `npx vitest run src/ordinare "src/app/tavolo"` → atteso tutto verde (vista-carrello: 1 test; componenti del tavolo: 6 test). Poi `npm run typecheck` e `npm run lint`: **nessun** errore `react-hooks`.
- [x] **Step 5: commit** — `git add -A src/ordinare "src/app/tavolo/[chiave]" && git commit -m "Carrello, card dei piatti e composer condivisi tra tavolo e casa"`

---

### Task 8: Ordini da casa — invio, accettazione, stati, anonimizzazione

**File:** crea `src/casa/ordini-casa-repo.ts` (+test); modifica `src/tavoli/ordini-repo.ts`.

Le modifiche a `ordini-repo.ts`:
- estraggono `prezzaRighe`/`salvaRighe` da `creaOrdineTavolo`, senza cambiare il comportamento del tavolo;
- con `pokeDaCasa` chiedono gli allergeni della poke confermati;
- limitano `avanzaStato` e `annullaOrdine` a `tipo='tavolo'`;
- in `annullaRiga` escludono anche gli ordini rifiutati;
- in `ricalcolaOrdine` aggiungono la consegna e accodano l'email «annullato» per gli ordini da casa rimasti senza righe.

**Interfacce prodotte:**
- tipi: `OrdineCasa`, `OrdineCasaClient`, `EsitoCasa`, `InputOrdineCasa`;
- `perClient(o)`, `tokenValido(t)`;
- letture: `ordineCasaPerToken`, `ordineCasaPerId`, `ordiniCasaAttivi`;
- `creaOrdineCasa(db,input)`;
- passaggi: `accettaOrdine(db,id,0|15|30)`, `rifiutaOrdine(db,id,motivo)`, `avanzaOrdineCasa(db,id,da)`, `annullaOrdineCasa(db,id)`;
- `anonimizzaOrdiniCasa(db,adesso): number`;
- in `ordini-repo`: `prezzaRighe(tx,righe,{ pokeDaCasa })`, `salvaRighe(tx,ordineId,righe)`, `RigaDaSalvare`, `EsitoPrezzi`.

- [x] **Step 1: test**

**Crea** `src/casa/ordini-casa-repo.test.ts` con:

```ts
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import type { DatiCheckout } from '@/domain/checkout'
import type { RigaCarrello } from '@/domain/carrello'
import { aggiungiOrario, creaZona, impostaApertura, salvaImpostazioni, type Zona } from './impostazioni-repo'
import { accettaOrdine, anonimizzaOrdiniCasa, annullaOrdineCasa, avanzaOrdineCasa, creaOrdineCasa, ordineCasaPerToken, ordiniCasaAttivi, rifiutaOrdine, type InputOrdineCasa } from './ordini-casa-repo'
import { annullaRiga, ordiniAttivi } from '@/tavoli/ordini-repo'
import { leggiPokeConfig, salvaAllergeniPoke, salvaPokeConfig, leggiAllergeniPoke } from '@/tavoli/poke-repo'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, piatto: string, zona: Zona
// Lunedì 12/10/2026 alle 18:00 di Roma; prima fascia prenotabile: 18:30 (16:30 UTC).
const ADESSO = new Date('2026-10-12T16:00:00Z')
const F1830 = new Date('2026-10-12T16:30:00.000Z'), F1845 = new Date('2026-10-12T16:45:00.000Z')
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  const { db } = ambiente
  await db.query('update piatti set allergeni_confermati=true')
  await salvaImpostazioni(db,{ capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '20:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '20:00' })
  zona = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
  piatto = (await db.query<{ id: string }>('select id from piatti where numero=1'))[0].id // 6,00 €
})
afterEach(async () => { await ambiente.pg.close() })
const asporto: DatiCheckout = { tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: F1830,nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null }
const domicilio = (): DatiCheckout => ({ ...asporto,tipo: 'domicilio',zonaId: zona.id,indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi' })
const righe = (quantita = 2): RigaCarrello[] => [{ piattoId: piatto,quantita,nota: 'senza sesamo' }]
const invia = (diverso: Partial<InputOrdineCasa> = {}) => creaOrdineCasa(ambiente.db,{ righe: righe(),dati: asporto,totaleVistoCent: 1200,chiaveInvio: randomUUID(),rete: '192.0.2.1',adesso: ADESSO,prova: false,...diverso })
async function crea(diverso: Partial<InputOrdineCasa> = {}) { const e = await invia(diverso); if (!e.ok) throw new Error(e.errore); return e.ordine }
it('asporto: ordine in attesa con token, righe copiate ed email «ricevuto» in coda', async () => {
  const o = await crea()
  expect(o).toMatchObject({ tipo: 'asporto',stato: 'in_attesa',totaleCent: 1200,consegnaCent: 0,clienteNome: 'Anna',zonaNome: null,pagamento: 'carta',anonimizzato: false })
  expect(o.token).toMatch(/^[A-Za-z0-9_-]{32}$/); expect(o.fascia.toISOString()).toBe(F1830.toISOString())
  expect(o.righe).toMatchObject([{ nome: expect.any(String),prezzoUnitCent: 600,quantita: 2,nota: 'senza sesamo' }])
  expect(await ambiente.db.query('select tipo from email_ordini')).toEqual([{ tipo: 'ricevuto' }])
  expect(await ordineCasaPerToken(ambiente.db,o.token)).toMatchObject({ id: o.id })
  expect(await ordineCasaPerToken(ambiente.db,'corto')).toBeNull()
})
it('lo stesso invio ripetuto restituisce lo stesso ordine', async () => {
  const chiaveInvio = randomUUID()
  const a = await crea({ chiaveInvio }), b = await crea({ chiaveInvio })
  expect(b.id).toBe(a.id); expect(await ambiente.db.query('select id from ordini')).toHaveLength(1)
})
it('totale cambiato, contanti insufficienti e piatto esaurito: nessun ordine', async () => {
  expect(await invia({ totaleVistoCent: 1000 })).toMatchObject({ ok: false,campo: 'carrello',totaleCent: 1200,errore: expect.stringContaining('I prezzi sono cambiati') })
  expect(await invia({ dati: { ...asporto,pagamento: 'contanti',contantiDaCent: 1000 } })).toMatchObject({ ok: false,campo: 'contantiDa' })
  await ambiente.db.query('update piatti set disponibile=false where id=$1',[piatto])
  expect(await invia()).toMatchObject({ ok: false,campo: 'carrello',nonDisponibiliIds: [piatto] })
  expect(await ambiente.db.query('select id from ordini')).toEqual([])
})
it('domicilio: minimo della zona, costo di consegna e zona copiata', async () => {
  expect(await invia({ dati: domicilio(),righe: righe(1),totaleVistoCent: 800 })).toMatchObject({ ok: false,errore: 'Mancano 9,00 € per l’ordine minimo di Bitetto.' })
  const o = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  expect(o).toMatchObject({ tipo: 'domicilio',totaleCent: 2000,consegnaCent: 200,zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi' })
  await ambiente.db.query('update zone_consegna set attiva=false')
  expect(await invia({ dati: { ...domicilio(),fascia: F1845 },righe: righe(3),totaleVistoCent: 2000 })).toMatchObject({ ok: false,campo: 'tipo',errore: 'Consegne a domicilio non disponibili.' })
})
it('capacità: tetto consegne e totale per fascia', async () => {
  await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  const pieno = await invia({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  expect(pieno).toMatchObject({ ok: false,campo: 'fascia' })
  if (!pieno.ok) expect(pieno.fasce).not.toContain(F1830.toISOString())
  await crea()
  expect(await invia()).toMatchObject({ ok: false,campo: 'fascia' })
  // Un ordine rifiutato libera il posto.
  const [o] = await ambiente.db.query<{ id: string }>(`select id from ordini where tipo='asporto'`)
  await rifiutaOrdine(ambiente.db,o.id,'Fascia piena')
  await crea()
})
it('ordini chiusi: interruttore spento, allergeni da confermare (salvo prova) e fascia troppo vicina', async () => {
  await impostaApertura(ambiente.db,null)
  expect(await invia()).toMatchObject({ ok: false,campo: 'tipo',errore: 'Ordini online chiusi in questo momento.' })
  await impostaApertura(ambiente.db,'2026-10-12')
  await ambiente.db.query('update piatti set allergeni_confermati=false where numero=2')
  expect(await invia()).toMatchObject({ ok: false,errore: expect.stringContaining('allergeni') })
  await crea({ prova: true })
  expect(await invia({ prova: true,dati: { ...asporto,fascia: new Date('2026-10-12T16:15:00.000Z') } })).toMatchObject({ ok: false,campo: 'fascia' })
})
it('limiti: tre ordini in attesa per telefono e dieci all’ora per rete', async () => {
  await ambiente.db.query('update impostazioni_casa set capacita_fascia=50,capacita_consegne=50')
  for (let i = 0; i < 3; i++) await crea()
  expect(await invia()).toMatchObject({ ok: false,campo: 'telefono' })
  for (let i = 0; i < 7; i++) await crea({ dati: { ...asporto,telefono: `33300000${i}0` } })
  expect(await invia({ dati: { ...asporto,telefono: '3339999999' } })).toMatchObject({ ok: false,errore: expect.stringContaining('connessione') })
  await crea({ dati: { ...asporto,telefono: '3339999999' },rete: '198.51.100.7' })
  await crea({ dati: { ...asporto,telefono: '3338888888' },rete: null })
})
it('poke composta da casa solo con gli allergeni degli ingredienti confermati', async () => {
  const { db } = ambiente
  const c = (await leggiPokeConfig(db))!; c.prezzoBaseCent = 900; c.prezzoExtraCent = 100; await salvaPokeConfig(db,c)
  const poke = Object.fromEntries(c.gruppi.map(g => [g.nome,g.voci.slice(0,g.min)]))
  const conPoke = { righe: [{ piattoId: null,quantita: 1,nota: '',poke }],totaleVistoCent: 900 }
  expect(await invia(conPoke)).toMatchObject({ ok: false,campo: 'carrello',errore: expect.stringContaining('poke composta') })
  await salvaAllergeniPoke(db,{ ...(await leggiAllergeniPoke(db,c)),confermati: true })
  expect(await crea(conPoke)).toMatchObject({ totaleCent: 900,righe: [{ nome: 'Poke composta' }] })
})
it('accettazione con ritardo, passaggi di stato e doppio tocco', async () => {
  const { db } = ambiente
  const o = await crea()
  expect(await accettaOrdine(db,o.id,15)).toMatchObject({ stato: 'accettato',fascia: F1845 })
  expect(await accettaOrdine(db,o.id,0)).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'in_attesa')).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'accettato')).toMatchObject({ stato: 'in_preparazione' })
  expect(await avanzaOrdineCasa(db,o.id,'accettato')).toBeNull()
  expect(await avanzaOrdineCasa(db,o.id,'in_preparazione')).toMatchObject({ stato: 'pronto' })
  expect(await avanzaOrdineCasa(db,o.id,'pronto')).toMatchObject({ stato: 'completato' })
  expect(await annullaOrdineCasa(db,o.id)).toBeNull()
  const d = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  await accettaOrdine(db,d.id,0); await avanzaOrdineCasa(db,d.id,'accettato'); await avanzaOrdineCasa(db,d.id,'in_preparazione')
  expect(await avanzaOrdineCasa(db,d.id,'pronto')).toMatchObject({ stato: 'in_consegna' })
  expect(await annullaOrdineCasa(db,d.id)).toMatchObject({ stato: 'annullato' })
  expect((await db.query<{ tipo: string }>('select tipo from email_ordini where ordine_id=$1 order by creata_il,tipo',[d.id])).map(e => e.tipo).sort()).toEqual(['accettato','annullato','ricevuto'])
  expect(await accettaOrdine(db,o.id,20 as 15)).toBeNull()
})
it('rifiuto con motivo ed email; si rifiuta solo un ordine in attesa', async () => {
  const { db } = ambiente
  const o = await crea()
  expect(await annullaOrdineCasa(db,o.id)).toBeNull()
  expect(await rifiutaOrdine(db,o.id,'Zona non servita')).toMatchObject({ stato: 'rifiutato',motivoRifiuto: 'Zona non servita' })
  expect(await rifiutaOrdine(db,o.id,'Altro')).toBeNull()
  expect(await db.query(`select tipo from email_ordini where tipo='rifiutato'`)).toHaveLength(1)
})
it('annullare righe ricalcola con la consegna; senza righe l’ordine è annullato con email', async () => {
  const { db } = ambiente
  const d = await crea({ dati: domicilio(),righe: [{ piattoId: piatto,quantita: 3,nota: '' },{ piattoId: (await db.query<{ id: string }>('select id from piatti where numero=2'))[0].id,quantita: 1,nota: '' }],totaleVistoCent: 2000 + (await db.query<{ p: number }>('select prezzo_cent as p from piatti where numero=2'))[0].p })
  await accettaOrdine(db,d.id,0)
  expect(await annullaRiga(db,d.righe[1].id)).toBe(true)
  expect((await ordiniCasaAttivi(db))[0]).toMatchObject({ totaleCent: 2000,stato: 'accettato' })
  expect(await annullaRiga(db,d.righe[0].id)).toBe(true)
  expect(await ordiniCasaAttivi(db)).toEqual([])
  expect(await db.query(`select stato,totale_cent from ordini where id=$1`,[d.id])).toEqual([{ stato: 'annullato',totale_cent: 0 }])
  expect(await db.query(`select tipo from email_ordini where ordine_id=$1 and tipo='annullato'`,[d.id])).toHaveLength(1)
})
it('cucina: da casa in ordine di fascia, esclusi dalla lettura dei tavoli', async () => {
  const { db } = ambiente
  const tardi = await crea({ dati: { ...asporto,fascia: F1845 } })
  const presto = await crea()
  expect((await ordiniCasaAttivi(db)).map(o => o.id)).toEqual([presto.id,tardi.id])
  expect(await ordiniAttivi(db)).toEqual([])
})
it('anonimizzazione dopo 12 mesi, idempotente', async () => {
  const { db } = ambiente
  const vecchio = await crea({ dati: domicilio(),righe: righe(3),totaleVistoCent: 2000 })
  const recente = await crea()
  await db.query(`update ordini set creato_il='2025-10-01T10:00:00Z' where id=$1`,[vecchio.id])
  expect(await anonimizzaOrdiniCasa(db,ADESSO)).toBe(1)
  expect(await anonimizzaOrdiniCasa(db,ADESSO)).toBe(0)
  expect(await db.query(`select cliente_nome,cliente_telefono,cliente_email,indirizzo,note_consegna,rete,anonimizzato_il is not null as fatto,zona_nome,totale_cent from ordini where id=$1`,[vecchio.id]))
    .toEqual([{ cliente_nome: null,cliente_telefono: null,cliente_email: null,indirizzo: null,note_consegna: null,rete: null,fatto: true,zona_nome: 'Bitetto',totale_cent: 2000 }])
  expect(await db.query('select nota from righe_ordine where ordine_id=$1',[vecchio.id])).toEqual([{ nota: null }])
  expect(await db.query('select cliente_nome from ordini where id=$1',[recente.id])).toEqual([{ cliente_nome: 'Anna' }])
})
```


- [x] **Step 2:** `npx vitest run src/casa/ordini-casa-repo.test.ts` → atteso **FAIL**.
- [x] **Step 3: codice**

**Modifica** `src/tavoli/ordini-repo.ts` (1 di 6): sostituisci

```ts
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { prossimoStato, type StatoOrdineTavolo } from '@/domain/stati-tavolo'
import { leggiPokeConfig } from './poke-repo'
import { idValido } from './validazione'

export interface RigaOrdine { id: string; numero: number | null; nome: string; prezzoUnitCent: number; quantita: number; nota: string | null; poke: SceltePoke | null; annullata: boolean }
```

con

```ts
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { prossimoStato, type StatoOrdineTavolo } from '@/domain/stati-tavolo'
import { leggiAllergeniPoke, leggiPokeConfig } from './poke-repo'
import { idValido } from './validazione'

export interface RigaOrdine { id: string; numero: number | null; nome: string; prezzoUnitCent: number; quantita: number; nota: string | null; poke: SceltePoke | null; annullata: boolean }
```

**Modifica** `src/tavoli/ordini-repo.ts` (2 di 6): sostituisci

```ts
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordini.map(o => o.id)])
  return ordini.map(o => ({ ...o,righe: righe.filter(r => r.ordineId === o.id).map(r => ({ id: r.id, numero: r.numero, nome: r.nome, prezzoUnitCent: r.prezzoUnitCent, quantita: r.quantita, nota: r.nota, poke: r.poke, annullata: r.annullata })) }))
}
async function ordineGiaInviato(db: Db,sessioneId: string,key: string): Promise<EsitoCreazione | null> {
  const [o] = await leggiOrdini(db,'o.chiave_invio=$1',[key])
  return o ? o.sessioneId === sessioneId ? { ok: true,ordine: o } : { ok: false,errore: 'Invio non valido: ricarica il carrello e riprova.' } : null
```

con

```ts
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordini.map(o => o.id)])
  return ordini.map(o => ({ ...o,righe: righe.filter(r => r.ordineId === o.id).map(r => ({ id: r.id, numero: r.numero, nome: r.nome, prezzoUnitCent: r.prezzoUnitCent, quantita: r.quantita, nota: r.nota, poke: r.poke, annullata: r.annullata })) }))
}
export type RigaDaSalvare = Omit<RigaOrdine,'id' | 'annullata'> & { piattoId: string | null }
export type EsitoPrezzi = { ok: true; righe: RigaDaSalvare[]; totaleCent: number } | { ok: false; errore: string; nonDisponibili?: string[]; nonDisponibiliIds?: string[] }
/**
 * Prezzi delle righe ricalcolati dal DB, dentro la transazione dell'invio (piatti e poke restano bloccati fino al commit).
 * `pokeDaCasa`: la poke composta richiede anche gli allergeni degli ingredienti confermati.
 */
export async function prezzaRighe(tx: Db, carrello: RigaCarrello[], { pokeDaCasa = false } = {}): Promise<EsitoPrezzi> {
  const ids = [...new Set(carrello.flatMap(r => r.piattoId ? [r.piattoId] : []))].sort()
  const piatti = await tx.query<{ id: string; numero: number | null; nome: string; prezzo_cent: number; disponibile: boolean }>('select id,numero,nome,prezzo_cent,disponibile from piatti where id=any($1::uuid[]) order by id for share',[ids])
  const nonDisponibiliIds = ids.filter(id => !piatti.find(p => p.id === id)?.disponibile)
  const nonDisponibili = nonDisponibiliIds.map(id => piatti.find(p => p.id === id)?.nome ?? 'Piatto non più in menù')
  if (nonDisponibili.length) return { ok: false, errore: 'Alcuni piatti non sono più disponibili', nonDisponibili, nonDisponibiliIds }
  if (carrello.some(r => r.piattoId === null)) await tx.query('select id from poke_config where id=1 for share')
  const config = carrello.some(r => r.piattoId === null) ? await leggiPokeConfig(tx) : null
  if (config && pokeDaCasa && !(await leggiAllergeniPoke(tx,config)).confermati) return { ok: false, errore: 'La poke composta non si può ordinare online in questo momento: rimuovila dal carrello.' }
  const righe: RigaDaSalvare[] = []
  for (const r of carrello) {
    if (r.piattoId) {
      const p = piatti.find(p => p.id === r.piattoId)!
      righe.push({ piattoId: p.id, numero: p.numero, nome: p.nome, prezzoUnitCent: p.prezzo_cent, quantita: r.quantita, nota: r.nota || null, poke: null })
    } else {
      if (!config) return { ok: false, errore: 'La poke composta non è ancora disponibile' }
      const poke = validaPoke(config,r.poke)
      if (!poke.ok) return poke
      righe.push({ piattoId: null, numero: null, nome: 'Poke composta', prezzoUnitCent: poke.prezzoCent, quantita: r.quantita, nota: r.nota || null, poke: poke.scelte })
    }
  }
  const totaleCent = righe.reduce((s,r) => s + r.prezzoUnitCent * r.quantita,0)
  if (!Number.isSafeInteger(totaleCent) || totaleCent > 2147483647) return { ok: false, errore: 'Il totale dell’ordine è troppo alto.' }
  return { ok: true, righe, totaleCent }
}
export async function salvaRighe(tx: Db, ordineId: string, righe: RigaDaSalvare[]): Promise<void> {
  for (const [i,r] of righe.entries()) await tx.query(`insert into righe_ordine(ordine_id,piatto_id,numero,nome,prezzo_unit_cent,quantita,nota,poke,posizione) values ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9)`,[ordineId,r.piattoId,r.numero,r.nome,r.prezzoUnitCent,r.quantita,r.nota,r.poke ? JSON.stringify(r.poke) : null,i])
}
async function ordineGiaInviato(db: Db,sessioneId: string,key: string): Promise<EsitoCreazione | null> {
  const [o] = await leggiOrdini(db,'o.chiave_invio=$1',[key])
  return o ? o.sessioneId === sessioneId ? { ok: true,ordine: o } : { ok: false,errore: 'Invio non valido: ricarica il carrello e riprova.' } : null
```

**Modifica** `src/tavoli/ordini-repo.ts` (3 di 6): sostituisci

```ts
    const dopoLock = await ordineGiaInviato(tx,sessioneId,chiaveInvio)
    if (dopoLock) return dopoLock
    if (!s || s.chiusaIl) return chiuso
    const ids = [...new Set(carrello.righe.flatMap(r => r.piattoId ? [r.piattoId] : []))].sort()
    const piatti = await tx.query<{ id: string; numero: number | null; nome: string; prezzo_cent: number; disponibile: boolean }>('select id,numero,nome,prezzo_cent,disponibile from piatti where id=any($1::uuid[]) order by id for share',[ids])
    const nonDisponibiliIds = ids.filter(id => !piatti.find(p => p.id === id)?.disponibile)
    const nonDisponibili = nonDisponibiliIds.map(id => piatti.find(p => p.id === id)?.nome ?? 'Piatto non più in menù')
    if (nonDisponibili.length) return { ok: false, errore: 'Alcuni piatti non sono più disponibili', nonDisponibili, nonDisponibiliIds }
    if (carrello.righe.some(r => r.piattoId === null)) await tx.query('select id from poke_config where id=1 for share')
    const config = carrello.righe.some(r => r.piattoId === null) ? await leggiPokeConfig(tx) : null
    const righe: (Omit<RigaOrdine,'id' | 'annullata'> & { piattoId: string | null })[] = []
    for (const r of carrello.righe) {
      if (r.piattoId) {
        const p = piatti.find(p => p.id === r.piattoId)!
        righe.push({ piattoId: p.id, numero: p.numero, nome: p.nome, prezzoUnitCent: p.prezzo_cent, quantita: r.quantita, nota: r.nota || null, poke: null })
      } else {
        if (!config) return { ok: false, errore: 'La poke composta non è ancora disponibile' }
        const poke = validaPoke(config,r.poke)
        if (!poke.ok) return poke
        righe.push({ piattoId: null, numero: null, nome: 'Poke composta', prezzoUnitCent: poke.prezzoCent, quantita: r.quantita, nota: r.nota || null, poke: poke.scelte })
      }
    }
    const totale = righe.reduce((s,r) => s + r.prezzoUnitCent * r.quantita,0)
    if (!Number.isSafeInteger(totale) || totale > 2147483647) return { ok: false, errore: 'Il totale dell’ordine è troppo alto.' }
    const [ordine] = await tx.query<{ id: string }>('insert into ordini(sessione_id,totale_cent,chiave_invio,creato_il) values ($1,$2,$3,clock_timestamp()) returning id',[sessioneId,totale,chiaveInvio])
    for (const [i,r] of righe.entries()) await tx.query(`insert into righe_ordine(ordine_id,piatto_id,numero,nome,prezzo_unit_cent,quantita,nota,poke,posizione) values ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9)`,[ordine.id,r.piattoId,r.numero,r.nome,r.prezzoUnitCent,r.quantita,r.nota,r.poke ? JSON.stringify(r.poke) : null,i])
    return { ok: true, ordine: (await leggiOrdini(tx,'o.id=$1',[ordine.id]))[0] }
  }) } catch (err) {
    // Dopo il rollback possiamo rileggere anche il conflitto tra sessioni diverse.
```

con

```ts
    const dopoLock = await ordineGiaInviato(tx,sessioneId,chiaveInvio)
    if (dopoLock) return dopoLock
    if (!s || s.chiusaIl) return chiuso
    const prezzi = await prezzaRighe(tx,carrello.righe)
    if (!prezzi.ok) return prezzi
    const [ordine] = await tx.query<{ id: string }>('insert into ordini(sessione_id,totale_cent,chiave_invio,creato_il) values ($1,$2,$3,clock_timestamp()) returning id',[sessioneId,prezzi.totaleCent,chiaveInvio])
    await salvaRighe(tx,ordine.id,prezzi.righe)
    return { ok: true, ordine: (await leggiOrdini(tx,'o.id=$1',[ordine.id]))[0] }
  }) } catch (err) {
    // Dopo il rollback possiamo rileggere anche il conflitto tra sessioni diverse.
```

**Modifica** `src/tavoli/ordini-repo.ts` (4 di 6): sostituisci

```ts
export async function avanzaStato(db: Db, ordineId: string): Promise<Ordine | null> {
  if (!idValido(ordineId)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ stato: StatoOrdineTavolo }>('select stato from ordini where id=$1 for update',[ordineId])
    const stato = o ? prossimoStato(o.stato) : null
    if (!stato) return null
    await tx.query('update ordini set stato=$2,aggiornato_il=now() where id=$1',[ordineId,stato])
```

con

```ts
export async function avanzaStato(db: Db, ordineId: string): Promise<Ordine | null> {
  if (!idValido(ordineId)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ stato: StatoOrdineTavolo }>("select stato from ordini where id=$1 and tipo='tavolo' for update",[ordineId])
    const stato = o ? prossimoStato(o.stato) : null
    if (!stato) return null
    await tx.query('update ordini set stato=$2,aggiornato_il=now() where id=$1',[ordineId,stato])
```

**Modifica** `src/tavoli/ordini-repo.ts` (5 di 6): sostituisci

```ts
}
export async function annullaOrdine(db: Db, ordineId: string): Promise<boolean> {
  if (!idValido(ordineId)) return false
  return (await db.query("update ordini set stato='annullato',aggiornato_il=now() where id=$1 and stato in ('inviato','in_preparazione') returning id",[ordineId])).length === 1
}
export async function annullaRiga(db: Db, rigaId: string): Promise<boolean> {
  if (!idValido(rigaId)) return false
  return db.transazione(async tx => {
    // Il lock sull'ordine serializza annullamenti di righe diverse e il ricalcolo.
    const [o] = await tx.query<{ id: string }>(`select o.id from ordini o join righe_ordine r on r.ordine_id=o.id where r.id=$1 and o.stato <> 'annullato' for update of o`,[rigaId])
    if (!o) return false
    const righe = await tx.query('update righe_ordine set annullata=true where id=$1 and not annullata returning id',[rigaId])
    if (!righe.length) return false
```

con

```ts
}
export async function annullaOrdine(db: Db, ordineId: string): Promise<boolean> {
  if (!idValido(ordineId)) return false
  return (await db.query("update ordini set stato='annullato',aggiornato_il=now() where id=$1 and tipo='tavolo' and stato in ('inviato','in_preparazione') returning id",[ordineId])).length === 1
}
export async function annullaRiga(db: Db, rigaId: string): Promise<boolean> {
  if (!idValido(rigaId)) return false
  return db.transazione(async tx => {
    // Il lock sull'ordine serializza annullamenti di righe diverse e il ricalcolo.
    const [o] = await tx.query<{ id: string }>(`select o.id from ordini o join righe_ordine r on r.ordine_id=o.id where r.id=$1 and o.stato not in ('annullato','rifiutato') for update of o`,[rigaId])
    if (!o) return false
    const righe = await tx.query('update righe_ordine set annullata=true where id=$1 and not annullata returning id',[rigaId])
    if (!righe.length) return false
```

**Modifica** `src/tavoli/ordini-repo.ts` (6 di 6): sostituisci

```ts
    return true
  })
}
async function ricalcolaOrdine(db: Db,id: string) {
  await db.query(`update ordini set totale_cent=r.totale,stato=case when r.n=0 then 'annullato' else ordini.stato end,aggiornato_il=clock_timestamp() from (select coalesce(sum(prezzo_unit_cent*quantita),0)::int as totale,count(*) as n from righe_ordine where ordine_id=$1 and not annullata) r where ordini.id=$1`,[id])
}
export interface IdentitaVoce { nome: string; numero: number | null; prezzoUnitCent: number; poke: SceltePoke | null }
export async function annullaVoceConto(db: Db,sessioneId: string,v: IdentitaVoce): Promise<boolean> {
```

con

```ts
    return true
  })
}
// Totale = righe attive + consegna (solo domicilio). Senza righe attive l'ordine è annullato; da casa il cliente riceve l'email.
async function ricalcolaOrdine(db: Db,id: string) {
  await db.query(`update ordini set totale_cent=case when r.n=0 then 0 else r.totale+coalesce(ordini.consegna_cent,0) end,stato=case when r.n=0 then 'annullato' else ordini.stato end,aggiornato_il=clock_timestamp() from (select coalesce(sum(prezzo_unit_cent*quantita),0)::int as totale,count(*) as n from righe_ordine where ordine_id=$1 and not annullata) r where ordini.id=$1`,[id])
  await db.query(`insert into email_ordini (ordine_id,tipo) select id,'annullato' from ordini where id=$1 and tipo<>'tavolo' and stato='annullato' on conflict (ordine_id,tipo) do nothing`,[id])
}
export interface IdentitaVoce { nome: string; numero: number | null; prezzoUnitCent: number; poke: SceltePoke | null }
export async function annullaVoceConto(db: Db,sessioneId: string,v: IdentitaVoce): Promise<boolean> {
```


**Crea** `src/casa/ordini-casa-repo.ts` con:

```ts
import { randomBytes } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { totaliCasa, type CampoCheckout, type DatiCheckout, type Pagamento } from '@/domain/checkout'
import type { Servizio } from '@/domain/fasce'
import { TESTO_MOTIVO } from '@/domain/apertura-casa'
import { formatEuro } from '@/domain/soldi'
import { prossimoStatoCasa, puoAnnullareCasa, STATI_CASA, type StatoCasa } from '@/domain/stati-casa'
import { prezzaRighe, salvaRighe, type RigaOrdine } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
import { leggiDisponibilita } from './disponibilita'

export interface OrdineCasa {
  id: string; numero: number; tipo: Servizio; stato: StatoCasa; token: string; totaleCent: number; consegnaCent: number; fascia: Date; creatoIl: Date
  clienteNome: string | null; clienteTelefono: string | null; clienteEmail: string | null; zonaNome: string | null; indirizzo: string | null; noteConsegna: string | null
  pagamento: Pagamento; contantiDaCent: number | null; motivoRifiuto: string | null; anonimizzato: boolean; righe: RigaOrdine[]
}
export type OrdineCasaClient = Omit<OrdineCasa,'fascia' | 'creatoIl'> & { fascia: string; creatoIl: string }
export function perClient(o: OrdineCasa): OrdineCasaClient { return { ...o,fascia: o.fascia.toISOString(),creatoIl: new Date(o.creatoIl).toISOString() } }
export type EsitoCasa = { ok: true; ordine: OrdineCasa } | {
  ok: false; errore: string; campo?: CampoCheckout | 'carrello'; nonDisponibili?: string[]; nonDisponibiliIds?: string[]; totaleCent?: number; fasce?: string[]
}
export const MASSIMO_IN_ATTESA_TELEFONO = 3
export const MASSIMO_ORDINI_RETE_ORA = 10
export function tokenValido(t: unknown): t is string { return typeof t === 'string' && /^[A-Za-z0-9_-]{32}$/.test(t) }
const COLONNE = `o.id,o.numero,o.tipo,o.stato,o.token,o.totale_cent as "totaleCent",o.consegna_cent as "consegnaCent",o.fascia,o.creato_il as "creatoIl",
  o.cliente_nome as "clienteNome",o.cliente_telefono as "clienteTelefono",o.cliente_email as "clienteEmail",o.zona_nome as "zonaNome",o.indirizzo,
  o.note_consegna as "noteConsegna",o.pagamento,o.contanti_da_cent as "contantiDaCent",o.motivo_rifiuto as "motivoRifiuto",(o.anonimizzato_il is not null) as anonimizzato`
const COLONNE_RIGA = `id,numero,nome,prezzo_unit_cent as "prezzoUnitCent",quantita,nota,poke,annullata`
async function leggiOrdiniCasa(db: Db, condizione: string, parametri: unknown[] = []): Promise<OrdineCasa[]> {
  const ordini = await db.query<Omit<OrdineCasa,'righe'>>(`select ${COLONNE} from ordini o where o.tipo<>'tavolo' and ${condizione} order by o.fascia,o.creato_il,o.numero`,parametri)
  if (!ordini.length) return []
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordini.map(o => o.id)])
  return ordini.map(o => ({ ...o,righe: righe.filter(r => r.ordineId === o.id).map(r => ({ id: r.id,numero: r.numero,nome: r.nome,prezzoUnitCent: r.prezzoUnitCent,quantita: r.quantita,nota: r.nota,poke: r.poke,annullata: r.annullata })) }))
}
export async function ordineCasaPerToken(db: Db, token: string): Promise<OrdineCasa | null> {
  return tokenValido(token) ? (await leggiOrdiniCasa(db,'o.token=$1',[token]))[0] ?? null : null
}
export async function ordineCasaPerId(db: Db, id: string): Promise<OrdineCasa | null> {
  return idValido(id) ? (await leggiOrdiniCasa(db,'o.id=$1',[id]))[0] ?? null : null
}
/** Ordini da accettare e in cucina, in ordine di fascia. */
export async function ordiniCasaAttivi(db: Db): Promise<OrdineCasa[]> {
  return leggiOrdiniCasa(db,"o.stato in ('in_attesa','accettato','in_preparazione','pronto','in_consegna')")
}
async function giaInviato(db: Db, chiave: string): Promise<EsitoCasa | null> {
  const [o] = await db.query<{ id: string; tipo: string }>('select id,tipo from ordini where chiave_invio=$1',[chiave])
  if (!o) return null
  const ordine = o.tipo === 'tavolo' ? null : await ordineCasaPerId(db,o.id)
  return ordine ? { ok: true,ordine } : { ok: false,errore: 'Invio non valido: ricarica la pagina e riprova.' }
}
export interface InputOrdineCasa { righe: RigaCarrello[]; dati: DatiCheckout; totaleVistoCent: number; chiaveInvio: string; rete: string | null; adesso: Date; prova: boolean }
/** Crea l'ordine in attesa di accettazione. Tutti gli invii da casa si mettono in fila sul lock delle impostazioni. */
export async function creaOrdineCasa(db: Db, input: InputOrdineCasa): Promise<EsitoCasa> {
  const { dati,chiaveInvio } = input
  if (!idValido(chiaveInvio)) return { ok: false,errore: 'Chiave di invio non valida: ricarica la pagina e riprova.' }
  if (!Number.isSafeInteger(input.totaleVistoCent)) return { ok: false,errore: 'Totale non valido: ricarica la pagina e riprova.' }
  const carrello = validaCarrello(input.righe)
  if (!carrello.ok) return { ...carrello,campo: 'carrello' }
  try { return await db.transazione(async (tx): Promise<EsitoCasa> => {
    const esistente = await giaInviato(tx,chiaveInvio)
    if (esistente) return esistente
    await tx.query('select id from impostazioni_casa where id=1 for update')
    // Un invio con la stessa chiave può aver concluso mentre aspettavamo il lock.
    const dopoLock = await giaInviato(tx,chiaveInvio)
    if (dopoLock) return dopoLock
    const disponibilita = await leggiDisponibilita(tx,input.adesso,input.prova)
    const servizio = disponibilita.servizi[dati.tipo]
    if (!servizio.apertura.aperto) return { ok: false,errore: TESTO_MOTIVO[servizio.apertura.motivo],campo: 'tipo' }
    if (!servizio.fasce.includes(dati.fascia.toISOString())) return { ok: false,errore: 'L’orario scelto non è più disponibile: scegline un altro.',campo: 'fascia',fasce: servizio.fasce }
    const zona = dati.tipo === 'domicilio' ? disponibilita.zone.find(z => z.id === dati.zonaId) ?? null : null
    if (dati.tipo === 'domicilio' && !zona) return { ok: false,errore: 'Questa zona non è servita: scegline un’altra.',campo: 'zonaId' }
    const [{ n: inAttesa }] = await tx.query<{ n: number }>(`select count(*)::int as n from ordini where cliente_telefono=$1 and stato='in_attesa'`,[dati.telefono])
    if (inAttesa >= MASSIMO_IN_ATTESA_TELEFONO) return { ok: false,errore: 'Hai già degli ordini in attesa di conferma: aspetta la nostra risposta o chiamaci.',campo: 'telefono' }
    if (input.rete) {
      const [{ n }] = await tx.query<{ n: number }>(`select count(*)::int as n from ordini where rete=$1 and creato_il > $2::timestamptz - interval '1 hour'`,[input.rete,input.adesso])
      if (n >= MASSIMO_ORDINI_RETE_ORA) return { ok: false,errore: 'Troppi ordini da questa connessione: riprova più tardi o chiamaci.' }
    }
    const prezzi = await prezzaRighe(tx,carrello.righe,{ pokeDaCasa: true })
    if (!prezzi.ok) return { ...prezzi,campo: 'carrello' }
    const totali = totaliCasa(prezzi.totaleCent,dati.tipo,zona)
    if (totali.mancanteCent > 0) return { ok: false,errore: `Mancano ${formatEuro(totali.mancanteCent)} per l’ordine minimo di ${zona!.nome}.`,campo: 'carrello' }
    if (totali.totaleCent !== input.totaleVistoCent) return { ok: false,errore: `I prezzi sono cambiati: il totale ora è ${formatEuro(totali.totaleCent)}. Controlla il riepilogo e conferma di nuovo.`,campo: 'carrello',totaleCent: totali.totaleCent }
    if (dati.contantiDaCent !== null && dati.contantiDaCent < totali.totaleCent) return { ok: false,errore: `L’importo in contanti deve coprire il totale di ${formatEuro(totali.totaleCent)}.`,campo: 'contantiDa' }
    const token = randomBytes(24).toString('base64url')
    const [ordine] = await tx.query<{ id: string }>(`insert into ordini (tipo,stato,totale_cent,chiave_invio,creato_il,token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_id,zona_nome,consegna_cent,indirizzo,note_consegna,pagamento,contanti_da_cent,privacy_il,rete)
      values ($1,'in_attesa',$2,$3,clock_timestamp(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp(),$16) returning id`,
    [dati.tipo,totali.totaleCent,chiaveInvio,token,dati.fascia,dati.nome,dati.telefono,dati.email,zona?.id ?? null,zona?.nome ?? null,totali.consegnaCent,dati.indirizzo,dati.noteConsegna,dati.pagamento,dati.contantiDaCent,input.rete])
    await salvaRighe(tx,ordine.id,prezzi.righe)
    await tx.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[ordine.id])
    return { ok: true,ordine: (await ordineCasaPerId(tx,ordine.id))! }
  }) } catch (err) {
    // Due invii con la stessa chiave: il secondo trova l'ordine del primo dopo il rollback.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      const esistente = await giaInviato(db,chiaveInvio)
      if (esistente) return esistente
    }
    throw err
  }
}
// Ogni cambio di stato parte dallo stato visto dallo staff: un doppio tocco non salta un passaggio.
async function cambiaStato(db: Db, id: string, da: StatoCasa[], verso: (o: { tipo: Servizio; stato: StatoCasa }) => StatoCasa | null, extra: { set?: string; parametri?: unknown[]; email?: 'accettato' | 'rifiutato' | 'annullato' } = {}): Promise<OrdineCasa | null> {
  if (!idValido(id)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ tipo: Servizio; stato: StatoCasa }>(`select tipo,stato from ordini where id=$1 and tipo<>'tavolo' for update`,[id])
    if (!o || !da.includes(o.stato)) return null
    const nuovo = verso(o)
    if (!nuovo) return null
    await tx.query(`update ordini set stato=$2,aggiornato_il=clock_timestamp()${extra.set ? `,${extra.set}` : ''} where id=$1`,[id,nuovo,...(extra.parametri ?? [])])
    if (extra.email) await tx.query(`insert into email_ordini (ordine_id,tipo) values ($1,$2) on conflict (ordine_id,tipo) do nothing`,[id,extra.email])
    return ordineCasaPerId(tx,id)
  })
}
export async function accettaOrdine(db: Db, id: string, ritardoMinuti: 0 | 15 | 30): Promise<OrdineCasa | null> {
  if (![0,15,30].includes(ritardoMinuti)) return null
  return cambiaStato(db,id,['in_attesa'],() => 'accettato',{ set: `fascia=fascia + make_interval(mins => $3::int)`,parametri: [ritardoMinuti],email: 'accettato' })
}
export async function rifiutaOrdine(db: Db, id: string, motivo: string): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,['in_attesa'],() => 'rifiutato',{ set: 'motivo_rifiuto=$3',parametri: [motivo],email: 'rifiutato' })
}
export async function avanzaOrdineCasa(db: Db, id: string, da: StatoCasa): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,[da],o => prossimoStatoCasa(o.tipo,o.stato))
}
export async function annullaOrdineCasa(db: Db, id: string): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,STATI_CASA.filter(puoAnnullareCasa),() => 'annullato',{ email: 'annullato' })
}
/** Toglie i dati personali dagli ordini da casa più vecchi di 12 mesi. Idempotente. */
export async function anonimizzaOrdiniCasa(db: Db, adesso: Date): Promise<number> {
  return db.transazione(async tx => {
    const ordini = await tx.query<{ id: string }>(`update ordini set cliente_nome=null,cliente_telefono=null,cliente_email=null,indirizzo=null,note_consegna=null,contanti_da_cent=null,rete=null,anonimizzato_il=clock_timestamp()
      where tipo<>'tavolo' and anonimizzato_il is null and creato_il < $1::timestamptz - interval '12 months' returning id`,[adesso])
    if (ordini.length) await tx.query('update righe_ordine set nota=null where ordine_id=any($1::uuid[])',[ordini.map(o => o.id)])
    return ordini.length
  })
}
```


- [x] **Step 4:** `npx vitest run src/casa src/tavoli` → atteso tutto verde (ordini-casa-repo: **13 test**; i test esistenti del tavolo invariati). Poi `npm run typecheck` e `npm run lint`.
- [x] **Step 5: commit** — `git add src/tavoli/ordini-repo.ts src/casa/ordini-casa-repo.ts src/casa/ordini-casa-repo.test.ts && git commit -m "Ordini da casa: invio in fila sulla capacità, accettazione, stati e anonimizzazione"`

---

### Task 9: Email ai clienti

**File:**
- crea `src/domain/email-ordini.ts` (+test);
- crea in `src/casa/`: `resend.ts`, `email-repo.ts`, `coda-email.ts` (+test) e `avvia-email.ts`;
- crea `tests/db/casa-pronta.ts` (aiuto per i test).

**Interfacce prodotte:**
- `TipoEmail`, `componiEmail(dati): { oggetto,testo,html }`, `escapeHtml`;
- `configEmail(env): ConfigEmail | null`, `inviaConResend(config,a,email,idempotenza,fetch?)`;
- `prendiEmailDaInviare(db,limite?)`, `segnaInviata`, `segnaErrore`, `MASSIMO_TENTATIVI_EMAIL`;
- `smaltisciCodaEmail(db,env?,fetch?)`, `avviaInvioEmail()`. Quest'ultima usa `after()` di `next/server` e va chiamata solo da azioni o pagine.

- [x] **Step 1: test**

**Crea** `tests/db/casa-pronta.ts` con:

```ts
import { randomUUID } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { aggiungiOrario, creaZona, impostaApertura, salvaImpostazioni } from '@/casa/impostazioni-repo'
import { creaOrdineCasa, type OrdineCasa } from '@/casa/ordini-casa-repo'
// Lunedì 12/10/2026 alle 18:00 di Roma; prima fascia prenotabile: 18:30 (16:30 UTC).
export const ADESSO = new Date('2026-10-12T16:00:00Z')
export const F1830 = new Date('2026-10-12T16:30:00.000Z')
/** Database con seed pronto per gli ordini da casa: allergeni confermati, ordini aperti, una zona. */
export async function preparaCasa(db: Db) {
  await db.query('update piatti set allergeni_confermati=true')
  await salvaImpostazioni(db,{ capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '20:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '20:00' })
  const zona = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
  const [piatto] = await db.query<{ id: string }>('select id from piatti where numero=1') // 6,00 €
  return { zona,piatto: piatto.id }
}
/** Un ordine d'asporto di 2 × 6,00 € alle 18:30, a nome di Anna. */
export async function ordineAsporto(db: Db, piatto: string): Promise<OrdineCasa> {
  const e = await creaOrdineCasa(db,{ righe: [{ piattoId: piatto,quantita: 2,nota: '' }],totaleVistoCent: 1200,chiaveInvio: randomUUID(),rete: null,adesso: ADESSO,prova: false,
    dati: { tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: F1830,nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null } })
  if (!e.ok) throw new Error(e.errore)
  return e.ordine
}
```


**Crea** `src/domain/email-ordini.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { componiEmail, escapeHtml, type DatiEmail } from './email-ordini'
const base: DatiEmail = { tipo: 'ricevuto',numero: 12,servizio: 'domicilio',fascia: new Date('2026-10-12T17:15:00Z'),nome: 'Anna',totaleCent: 2000,consegnaCent: 200,zonaNome: 'Bitetto',
  indirizzo: 'Via Roma 1',pagamento: 'contanti',motivoRifiuto: null,righe: [{ quantita: 3,nome: 'Salmone',prezzoUnitCent: 600,annullata: false },{ quantita: 1,nome: 'Tonno',prezzoUnitCent: 700,annullata: true }],
  link: 'https://ordini.esempio.it/ordine/abc',telefono: '0801234567' }
it('ricevuto: riepilogo senza righe annullate, consegna, pagamento, link e telefono', () => {
  const e = componiEmail(base)
  expect(e.oggetto).toBe('Abbiamo ricevuto il tuo ordine n. 12')
  expect(e.testo).toContain('3 × Salmone · 18,00 €'); expect(e.testo).toContain('Consegna · 2,00 €'); expect(e.testo).not.toContain('Tonno')
  expect(e.testo).toContain('Totale 20,00 €, da pagare alla consegna (contanti).'); expect(e.testo).toContain('https://ordini.esempio.it/ordine/abc'); expect(e.testo).toContain('Tel. 0801234567')
})
it('accettato con l’ora di Roma, per domicilio e per asporto', () => {
  expect(componiEmail({ ...base,tipo: 'accettato' })).toMatchObject({ oggetto: 'Ordine n. 12 confermato per le 19:15',testo: expect.stringContaining('lo consegniamo verso le 19:15 in Via Roma 1 (Bitetto)') })
  expect(componiEmail({ ...base,tipo: 'accettato',servizio: 'asporto',consegnaCent: 0 }).testo).toContain('pronto per il ritiro alle 19:15')
  expect(componiEmail({ ...base,servizio: 'asporto',consegnaCent: 0,pagamento: 'carta' }).testo).toContain('da pagare al ritiro (carta)')
})
it('rifiutato con motivo e annullato', () => {
  expect(componiEmail({ ...base,tipo: 'rifiutato',motivoRifiuto: 'Fascia piena' })).toMatchObject({ oggetto: 'Ordine n. 12 non accettato',testo: expect.stringContaining('Motivo: Fascia piena') })
  expect(componiEmail({ ...base,tipo: 'annullato',telefono: null })).toMatchObject({ oggetto: 'Ordine n. 12 annullato',testo: expect.not.stringContaining('Tel.') })
})
it('nell’HTML i dati del cliente non possono iniettare markup', () => {
  const html = componiEmail({ ...base,nome: '<script>alert(1)</script>',indirizzo: '"><img src=x>',tipo: 'accettato' }).html
  expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).toContain('&lt;script&gt;')
  expect(escapeHtml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;')
})
```


**Crea** `src/casa/coda-email.test.ts` con:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'
import { smaltisciCodaEmail } from './coda-email'
import { prendiEmailDaInviare } from './email-repo'
import { configEmail } from './resend'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, piatto: string
const ENV = { RESEND_API_KEY: 're_prova',EMAIL_MITTENTE: "Daniel's Sushi <ordini@esempio.it>",APP_URL: 'https://ordini.esempio.it/qualcosa' }
beforeEach(async () => { ambiente = await creaDbDiTest({ seed: true }); ({ piatto } = await preparaCasa(ambiente.db)) })
afterEach(async () => { await ambiente.pg.close() })
const coda = () => ambiente.db.query<{ tipo: string; tentativi: number; inviata: boolean; errore: string | null; inInvio: boolean }>('select tipo,tentativi,inviata_il is not null as inviata,ultimo_errore as errore,in_invio_dal is not null as "inInvio" from email_ordini order by creata_il')
it('configurazione: servono chiave, mittente e un APP_URL http(s)', () => {
  expect(configEmail(ENV)).toEqual({ apiKey: 're_prova',mittente: ENV.EMAIL_MITTENTE,origine: 'https://ordini.esempio.it' })
  for (const diverso of [{ RESEND_API_KEY: '' },{ EMAIL_MITTENTE: undefined },{ APP_URL: 'ftp://x.it' },{ APP_URL: 'non un url' }]) expect(configEmail({ ...ENV,...diverso })).toBeNull()
})
it('email spente: la coda resta intatta', async () => {
  await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn()
  expect(await smaltisciCodaEmail(ambiente.db,{},fetchFinto)).toEqual({ inviate: 0,errori: 0 })
  expect(fetchFinto).not.toHaveBeenCalled()
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 0,inviata: false,errore: null,inInvio: false }])
})
it('invio riuscito: destinatario, chiave d’idempotenza e link della pagina dello stato', async () => {
  const o = await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn(async () => new Response('{"id":"x"}',{ status: 200 }))
  expect(await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)).toEqual({ inviate: 1,errori: 0 })
  const [url,opzioni] = fetchFinto.mock.calls[0] as unknown as [string,RequestInit]
  const [{ id }] = await ambiente.db.query<{ id: string }>('select id from email_ordini')
  expect(url).toBe('https://api.resend.com/emails')
  expect(opzioni.headers).toMatchObject({ Authorization: 'Bearer re_prova','Idempotency-Key': id })
  const corpo = JSON.parse(opzioni.body as string)
  expect(corpo).toMatchObject({ from: ENV.EMAIL_MITTENTE,to: ['anna@esempio.it'],subject: `Abbiamo ricevuto il tuo ordine n. ${o.numero}` })
  expect(corpo.text).toContain(`https://ordini.esempio.it/ordine/${o.token}`)
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 1,inviata: true,errore: null,inInvio: false }])
  expect(await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)).toEqual({ inviate: 0,errori: 0 })
})
it('errore di Resend registrato e ritentato, fino a 5 tentativi', async () => {
  await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn(async () => new Response('limite superato',{ status: 429 }))
  for (let i = 0; i < 6; i++) await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
  expect(fetchFinto).toHaveBeenCalledTimes(5)
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 5,inviata: false,errore: 'Resend 429: limite superato',inInvio: false }])
})
it('una presa in carico non viene ripresa per 2 minuti; gli ordini anonimizzati non partono', async () => {
  const o = await ordineAsporto(ambiente.db,piatto)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(1)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(0)
  await ambiente.db.query(`update email_ordini set in_invio_dal=now()-interval '3 minutes'`)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(1)
  await ambiente.db.query(`update email_ordini set in_invio_dal=null`)
  await ambiente.db.query(`update ordini set cliente_nome=null,cliente_telefono=null,cliente_email=null,anonimizzato_il=now() where id=$1`,[o.id])
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(0)
})
```


- [x] **Step 2:** `npx vitest run src/domain/email-ordini.test.ts src/casa/coda-email.test.ts` → atteso **FAIL**.
- [x] **Step 3: codice**

**Crea** `src/domain/email-ordini.ts` con:

```ts
import type { Servizio } from './fasce'
import { formatEuro } from './soldi'
import { oraRoma } from './ora-roma'
export type TipoEmail = 'ricevuto' | 'accettato' | 'rifiutato' | 'annullato'
export interface DatiEmail {
  tipo: TipoEmail; numero: number; servizio: Servizio; fascia: Date; nome: string; totaleCent: number; consegnaCent: number
  zonaNome: string | null; indirizzo: string | null; pagamento: 'contanti' | 'carta'; motivoRifiuto: string | null
  righe: { quantita: number; nome: string; prezzoUnitCent: number; annullata: boolean }[]; link: string; telefono: string | null
}
export interface Email { oggetto: string; testo: string; html: string }
export function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
function frasi(d: DatiEmail): { oggetto: string; apertura: string } {
  const ora = oraRoma(d.fascia), n = `Ordine n. ${d.numero}`
  if (d.tipo === 'ricevuto') return { oggetto: `Abbiamo ricevuto il tuo ordine n. ${d.numero}`,apertura: 'abbiamo ricevuto il tuo ordine. Ti scriviamo appena lo confermiamo: puoi seguirlo anche dalla pagina dell’ordine.' }
  if (d.tipo === 'accettato') return { oggetto: `${n} confermato per le ${ora}`,apertura: d.servizio === 'domicilio'
    ? `il tuo ordine è confermato: lo consegniamo verso le ${ora} in ${d.indirizzo ?? ''} (${d.zonaNome ?? ''}).`
    : `il tuo ordine è confermato: sarà pronto per il ritiro alle ${ora} in Via Beato Giacomo 72, Bitetto.` }
  if (d.tipo === 'rifiutato') return { oggetto: `${n} non accettato`,apertura: `purtroppo non possiamo accettare il tuo ordine${d.motivoRifiuto ? `. Motivo: ${d.motivoRifiuto}` : ''}. Ci scusiamo per il disagio.` }
  return { oggetto: `${n} annullato`,apertura: 'il tuo ordine è stato annullato. Per qualsiasi domanda chiamaci.' }
}
/** Oggetto, testo semplice e HTML di un'email al cliente; i dati del cliente sono sempre «escapati» nell'HTML. */
export function componiEmail(d: DatiEmail): Email {
  const { oggetto,apertura } = frasi(d)
  const righe = d.righe.filter(r => !r.annullata).map(r => `${r.quantita} × ${r.nome} · ${formatEuro(r.prezzoUnitCent * r.quantita)}`)
  if (d.consegnaCent > 0) righe.push(`Consegna · ${formatEuro(d.consegnaCent)}`)
  const pagamento = `Totale ${formatEuro(d.totaleCent)}, da pagare ${d.servizio === 'domicilio' ? 'alla consegna' : 'al ritiro'} (${d.pagamento === 'carta' ? 'carta' : 'contanti'}).`
  const contatti = `Daniel's Sushi · Via Beato Giacomo 72, Bitetto${d.telefono ? ` · Tel. ${d.telefono}` : ''}`
  const testo = [`Ciao ${d.nome},`,apertura,'',...righe,pagamento,'',`Segui l’ordine: ${d.link}`,'',contatti].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1c1c1e;max-width:560px">
<p>Ciao ${escapeHtml(d.nome)},</p><p>${escapeHtml(apertura)}</p>
<ul>${righe.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul><p><strong>${escapeHtml(pagamento)}</strong></p>
<p><a href="${escapeHtml(d.link)}">Segui l’ordine</a></p><p style="color:#6c6c70;font-size:14px">${escapeHtml(contatti)}</p></div>`
  return { oggetto,testo,html }
}
```


**Crea** `src/casa/resend.ts` con:

```ts
import type { Email } from '@/domain/email-ordini'
export interface ConfigEmail { apiKey: string; mittente: string; origine: string }
/** Configurazione delle email dall'ambiente; null (email spente) se manca qualcosa o APP_URL non è un URL http(s). */
export function configEmail(env: Record<string,string | undefined>): ConfigEmail | null {
  const apiKey = env.RESEND_API_KEY?.trim(), mittente = env.EMAIL_MITTENTE?.trim()
  if (!apiKey || !mittente || !env.APP_URL?.trim()) return null
  try {
    const url = new URL(env.APP_URL.trim())
    return ['http:','https:'].includes(url.protocol) ? { apiKey,mittente,origine: url.origin } : null
  } catch { return null }
}
export type EsitoInvio = { ok: true } | { ok: false; errore: string }
/** Invio con l'API HTTP di Resend. `idempotenza` evita doppioni se lo stesso invio viene ritentato entro 24 ore. */
export async function inviaConResend(config: ConfigEmail, a: string, email: Email, idempotenza: string, fetchFn: typeof fetch = fetch): Promise<EsitoInvio> {
  try {
    const risposta = await fetchFn('https://api.resend.com/emails',{
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`,'Content-Type': 'application/json','Idempotency-Key': idempotenza },
      body: JSON.stringify({ from: config.mittente,to: [a],subject: email.oggetto,text: email.testo,html: email.html }),
      signal: AbortSignal.timeout(10000),
    })
    if (risposta.ok) return { ok: true }
    return { ok: false,errore: `Resend ${risposta.status}: ${(await risposta.text().catch(() => '')).slice(0,300)}` }
  } catch (err) {
    return { ok: false,errore: err instanceof Error ? err.message.slice(0,300) : 'errore di rete' }
  }
}
```


**Crea** `src/casa/email-repo.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import type { TipoEmail } from '@/domain/email-ordini'
export interface EmailDaInviare { id: string; ordineId: string; tipo: TipoEmail }
export const MASSIMO_TENTATIVI_EMAIL = 5
/**
 * Prende in carico fino a `limite` email non inviate di ordini non anonimizzati.
 * Una presa in carico vale 2 minuti: se l'invio si interrompe, l'email torna disponibile.
 */
export async function prendiEmailDaInviare(db: Db, limite = 10): Promise<EmailDaInviare[]> {
  return db.query<EmailDaInviare>(`update email_ordini set in_invio_dal=clock_timestamp(),tentativi=tentativi+1 where id in (
    select e.id from email_ordini e join ordini o on o.id=e.ordine_id
    where e.inviata_il is null and e.tentativi < $1 and o.anonimizzato_il is null and (e.in_invio_dal is null or e.in_invio_dal < clock_timestamp() - interval '2 minutes')
    order by e.creata_il limit $2 for update of e skip locked
  ) returning id,ordine_id as "ordineId",tipo`,[MASSIMO_TENTATIVI_EMAIL,limite])
}
export async function segnaInviata(db: Db, id: string): Promise<void> {
  await db.query('update email_ordini set inviata_il=clock_timestamp(),in_invio_dal=null,ultimo_errore=null where id=$1',[id])
}
export async function segnaErrore(db: Db, id: string, errore: string): Promise<void> {
  await db.query('update email_ordini set in_invio_dal=null,ultimo_errore=$2 where id=$1',[id,errore.slice(0,500)])
}
```


**Crea** `src/casa/coda-email.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import { componiEmail } from '@/domain/email-ordini'
import { leggiImpostazioni } from './impostazioni-repo'
import { ordineCasaPerId } from './ordini-casa-repo'
import { prendiEmailDaInviare, segnaErrore, segnaInviata } from './email-repo'
import { configEmail, inviaConResend } from './resend'
type Ambiente = Record<string,string | undefined>
/** Invia le email in coda. Con le email spente (configurazione assente) non tocca la coda. */
export async function smaltisciCodaEmail(db: Db, env: Ambiente = process.env, fetchFn: typeof fetch = fetch): Promise<{ inviate: number; errori: number }> {
  const config = configEmail(env)
  if (!config) return { inviate: 0,errori: 0 }
  const da = await prendiEmailDaInviare(db)
  if (!da.length) return { inviate: 0,errori: 0 }
  const { telefono } = await leggiImpostazioni(db)
  let inviate = 0, errori = 0
  for (const e of da) {
    const o = await ordineCasaPerId(db,e.ordineId)
    if (!o || o.anonimizzato || !o.clienteEmail || !o.clienteNome) { await segnaErrore(db,e.id,'Ordine non disponibile'); errori++; continue }
    const email = componiEmail({ tipo: e.tipo,numero: o.numero,servizio: o.tipo,fascia: o.fascia,nome: o.clienteNome,totaleCent: o.totaleCent,consegnaCent: o.consegnaCent,zonaNome: o.zonaNome,
      indirizzo: o.indirizzo,pagamento: o.pagamento,motivoRifiuto: o.motivoRifiuto,righe: o.righe,link: `${config.origine}/ordine/${o.token}`,telefono })
    const esito = await inviaConResend(config,o.clienteEmail,email,e.id,fetchFn)
    if (esito.ok) { await segnaInviata(db,e.id); inviate++ } else { await segnaErrore(db,e.id,esito.errore); errori++ }
  }
  return { inviate,errori }
}
```


**Crea** `src/casa/avvia-email.ts` con:

```ts
import 'server-only'
import { after } from 'next/server'
import { db } from '@/server/db'
import { smaltisciCodaEmail } from './coda-email'
/** Invia le email in coda dopo la risposta: un errore non tocca mai l'ordine né la pagina. */
export function avviaInvioEmail(): void {
  after(async () => {
    try { await smaltisciCodaEmail(db) } catch (err) { console.error('Invio email non riuscito:',err instanceof Error ? err.message : 'errore sconosciuto') }
  })
}
```


- [x] **Step 4:** stesso comando → atteso **2 file, 9 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add src/domain/email-ordini.ts src/domain/email-ordini.test.ts src/casa/resend.ts src/casa/email-repo.ts src/casa/coda-email.ts src/casa/coda-email.test.ts src/casa/avvia-email.ts tests/db/casa-pronta.ts && git commit -m "Email ai clienti: testi, coda con nuovi tentativi e invio con Resend"`

---

### Task 10: Cliente da casa — menù ordinabile, checkout, pagina dello stato, privacy

**File:**
- in `src/app/(cliente)/`: crea `MenuCasa.tsx`, `OrdineInCorso.tsx`, `casa.css`, `componenti.test.tsx`, `ordina/` (`Checkout.tsx`, `azioni.ts` +test, `page.tsx`), `ordine/[token]/` (`StatoOrdine.tsx`, `page.tsx`) e `privacy/page.tsx`; sostituisci `page.tsx`;
- crea `src/ordinare/archivio-casa.ts` (+test);
- modifica `src/casa/disponibilita.ts` (`leggiPokeDaCasa`) e `src/ordinare/useCarrelloSalvato.ts` (`blocca`/`sblocca`).

**Interfacce prodotte:**
- azione `inviaOrdineCasa(json): EsitoCheckout`;
- `leggiPokeDaCasa(db)`;
- `CHIAVE_CARRELLO_CASA`, `CHIAVE_ULTIMO_ORDINE`, `leggiUltimoOrdine(testo,adesso)`;
- `StatoOrdine`, `ordineConcluso(stato)`.

- [x] **Step 1: test**

**Crea** `src/ordinare/archivio-casa.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { leggiUltimoOrdine } from './archivio-casa'
const token = 'abcdefghijklmnopqrstuvwxyz012345', adesso = Date.parse('2026-10-12T18:00:00Z')
it('ultimo ordine valido solo per 12 ore e con un token plausibile', () => {
  const salvato = (diverso: object) => JSON.stringify({ token,numero: 7,salvatoIl: adesso - 3600000,...diverso })
  expect(leggiUltimoOrdine(salvato({}),adesso)).toEqual({ token,numero: 7,salvatoIl: adesso - 3600000 })
  expect(leggiUltimoOrdine(salvato({ salvatoIl: adesso - 13 * 3600000 }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ salvatoIl: adesso + 3600000 }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ token: '../admin' }),adesso)).toBeNull()
  expect(leggiUltimoOrdine(salvato({ numero: '7' }),adesso)).toBeNull()
  for (const t of [null,'','{',JSON.stringify(null),'[]']) expect(leggiUltimoOrdine(t,adesso)).toBeNull()
})
```


**Crea** `src/app/(cliente)/ordina/azioni.test.ts` con:

```ts
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ creaOrdineCasa: vi.fn(), avviaInvioEmail: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/casa/ordini-casa-repo', () => ({ creaOrdineCasa: m.creaOrdineCasa }))
vi.mock('@/casa/avvia-email', () => ({ avviaInvioEmail: m.avviaInvioEmail }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '192.0.2.1' }) }))
import { inviaOrdineCasa } from './azioni'
const piatto = '11111111-1111-4111-8111-111111111111', chiaveInvio = '33333333-3333-4333-8333-333333333333'
const dati = { tipo: 'asporto',fascia: '2026-10-12T16:30:00.000Z',nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',privacy: true }
const corpo = (diverso: Record<string,unknown> = {}) => JSON.stringify({ righe: [{ piattoId: piatto,quantita: 2,nota: '' }],dati,totaleVistoCent: 1200,chiaveInvio,...diverso })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })
it('invio riuscito: dati normalizzati, rete del client, email avviate', async () => {
  m.creaOrdineCasa.mockResolvedValue({ ok: true,ordine: { token: 't'.repeat(32),numero: 7 } })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: true,token: 't'.repeat(32),numero: 7 })
  expect(m.creaOrdineCasa).toHaveBeenCalledWith({},expect.objectContaining({ totaleVistoCent: 1200,chiaveInvio,rete: '192.0.2.1',prova: false,dati: expect.objectContaining({ fascia: new Date(dati.fascia) }) }))
  expect(m.avviaInvioEmail).toHaveBeenCalledTimes(1)
})
it('JSON rotto, dati sbagliati e carrello vuoto non arrivano al repository', async () => {
  expect(await inviaOrdineCasa('{')).toMatchObject({ ok: false })
  expect(await inviaOrdineCasa(corpo({ dati: { ...dati,telefono: '1',privacy: false } }))).toMatchObject({ ok: false,errori: { telefono: expect.any(String),privacy: expect.any(String) } })
  expect(await inviaOrdineCasa(corpo({ righe: [] }))).toMatchObject({ ok: false })
  expect(await inviaOrdineCasa('x'.repeat(100001))).toMatchObject({ ok: false })
  expect(m.creaOrdineCasa).not.toHaveBeenCalled()
})
it('errori del repository: campo evidenziato, fasce rimaste, nuovo totale; niente email', async () => {
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'L’orario scelto non è più disponibile: scegline un altro.',campo: 'fascia',fasce: ['2026-10-12T16:45:00.000Z'] })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'L’orario scelto non è più disponibile: scegline un altro.',fasce: ['2026-10-12T16:45:00.000Z'],errori: { fascia: 'L’orario scelto non è più disponibile: scegline un altro.' } })
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'I prezzi sono cambiati',campo: 'carrello',totaleCent: 1400 })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'I prezzi sono cambiati',totaleCent: 1400 })
  expect(m.avviaInvioEmail).not.toHaveBeenCalled()
})
it('errore del database: messaggio italiano che invita a riprovare senza paura di doppioni', async () => {
  m.creaOrdineCasa.mockRejectedValueOnce(new Error('connessione'))
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' })
})
```


**Crea** `src/app/(cliente)/componenti.test.tsx` con:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(),push: vi.fn() }) }))
vi.mock('./ordina/azioni', () => ({ inviaOrdineCasa: vi.fn() }))
import { StatoOrdine, ordineConcluso } from './ordine/[token]/StatoOrdine'
import { Checkout } from './ordina/Checkout'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
const ordine: OrdineCasaClient = { id: 'o',numero: 12,tipo: 'domicilio',stato: 'in_attesa',token: 't'.repeat(32),totaleCent: 2000,consegnaCent: 200,fascia: '2026-10-12T17:15:00.000Z',creatoIl: '2026-10-12T16:00:00.000Z',
  clienteNome: 'Anna',clienteTelefono: '3331234567',clienteEmail: 'anna@esempio.it',zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: null,pagamento: 'contanti',contantiDaCent: 5000,motivoRifiuto: null,anonimizzato: false,
  righe: [{ id: 'r',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 3,nota: null,poke: null,annullata: false }] }
it('stato: in attesa, poi dopo 10 minuti il telefono del locale', () => {
  const presto = renderToStaticMarkup(<StatoOrdine ordine={ordine} telefono="0801234567" ora="2026-10-12T16:05:00.000Z" />)
  expect(presto).toContain('In attesa di conferma'); expect(presto).toContain('consegna verso le 19:15'); expect(presto).toContain('si aggiorna da sola'); expect(presto).not.toContain('Non abbiamo ancora risposto')
  const tardi = renderToStaticMarkup(<StatoOrdine ordine={ordine} telefono="0801234567" ora="2026-10-12T16:11:00.000Z" />)
  expect(tardi).toContain('Non abbiamo ancora risposto'); expect(tardi).toContain('href="tel:0801234567"')
})
it('stato: confermato con orario e pagamento, rifiutato con motivo, anonimizzato', () => {
  const ok = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'accettato' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(ok).toContain('Confermato'); expect(ok).toContain('Consegna verso le 19:15'); expect(ok).toContain('Via Roma 1 · Bitetto'); expect(ok).toContain('in contanti (con 50,00 €)'); expect(ok).toContain('Consegna: 2,00 €')
  const asporto = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,tipo: 'asporto',stato: 'pronto',consegnaCent: 0,indirizzo: null,zonaNome: null,pagamento: 'carta' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(asporto).toContain('Pronto per il ritiro'); expect(asporto).toContain('Ritiro alle 19:15'); expect(asporto).toContain('con carta')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'rifiutato',motivoRifiuto: 'Fascia piena' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).toContain('Non possiamo accettare l’ordine: Fascia piena')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,anonimizzato: true }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).toContain('Ordine non più disponibile')
  expect(['rifiutato','annullato','completato','in_consegna'].map(ordineConcluso)).toEqual([true,true,true,false])
})
it('checkout: servizio chiuso con motivo, orari in ora di Roma, conferma bloccata finché il carrello non è pronto', () => {
  const html = renderToStaticMarkup(<Checkout piatti={[]} poke={null} disponibilita={{ zone: [],servizi: {
    asporto: { aperto: true,motivo: null,fasce: ['2026-10-12T16:30:00.000Z'] },domicilio: { aperto: false,motivo: 'Consegne a domicilio non disponibili.',fasce: [] } } }} />)
  expect(html).toContain('Consegne a domicilio non disponibili.'); expect(html).toContain('>18:30</option>'); expect(html).toContain('Ritiro alle')
  expect(html).toContain('informativa privacy'); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Conferma l’ordine/)
})
```


- [x] **Step 2:** `npx vitest run src/ordinare/archivio-casa.test.ts "src/app/(cliente)"` → atteso **FAIL**.
- [x] **Step 3: codice**

**Crea** `src/ordinare/archivio-casa.ts` con:

```ts
// Chiavi di localStorage degli ordini da casa (solo comodità del cliente: nulla di affidabile).
export const CHIAVE_CARRELLO_CASA = 'ds_carrello_casa'
export const CHIAVE_ULTIMO_ORDINE = 'ds_ultimo_ordine'
export const ORE_ORDINE_IN_CORSO = 12
export interface UltimoOrdine { token: string; numero: number; salvatoIl: number }
/** Ultimo ordine salvato nel browser, se valido e più recente di 12 ore. */
export function leggiUltimoOrdine(testo: string | null, adesso: number): UltimoOrdine | null {
  if (!testo) return null
  try {
    const v: unknown = JSON.parse(testo)
    if (!v || typeof v !== 'object') return null
    const { token,numero,salvatoIl } = v as Record<string,unknown>
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(token) || !Number.isSafeInteger(numero) || typeof salvatoIl !== 'number') return null
    if (adesso - salvatoIl > ORE_ORDINE_IN_CORSO * 3600000 || salvatoIl > adesso + 60000) return null
    return { token,numero: numero as number,salvatoIl }
  } catch { return null }
}
```


**Modifica** `src/ordinare/useCarrelloSalvato.ts`: sostituisci

```ts
    return null
  }
  const svuota = () => imposta(VUOTO)
  return { carrello,ref,caricato,bloccato,imposta,modificaRighe,modificaPiatto,aggiungiPoke,svuota }
}
```

con

```ts
    return null
  }
  const svuota = () => imposta(VUOTO)
  /** Blocca le modifiche durante un invio; false se un invio è già in corso o il carrello non è pronto. */
  const blocca = (): boolean => {
    if (bloccato.current || !caricato || !ref.current.chiaveInvio) return false
    bloccato.current = true
    return true
  }
  const sblocca = () => { bloccato.current = false }
  return { carrello,ref,caricato,bloccato,imposta,modificaRighe,modificaPiatto,aggiungiPoke,svuota,blocca,sblocca }
}
```


**Sostituisci tutto il contenuto** di `src/casa/disponibilita.ts` con:

```ts
import type { Db } from '@/server/db-tipi'
import { fasceDelGiorno, fascePrenotabili, SERVIZI, type Occupazione, type RegoleFasce, type Servizio } from '@/domain/fasce'
import { aperturaServizio, type StatoApertura } from '@/domain/apertura-casa'
import { dataRoma, giornoSettimana, istanteRoma } from '@/domain/ora-roma'
import { STATI_ATTIVI_CASA } from '@/domain/stati-casa'
import { pokeOrdinabile } from '@/domain/poke'
import type { AllergeniVoci } from '@/domain/allergeni-poke'
import type { PokeConfig } from '@/menu/importa'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { allergeniCompleti, chiusoIl, elencoZone, leggiImpostazioni, turniDelGiorno, type Zona } from './impostazioni-repo'
export interface DisponibilitaServizio { apertura: StatoApertura; fasce: string[] }
export interface DisponibilitaCasa {
  oggi: string; telefono: string | null; apertiIl: string | null; regole: RegoleFasce; zone: Zona[]
  servizi: Record<Servizio,DisponibilitaServizio>
}
/** Poke composta ordinabile da casa: prezzi impostati e allergeni degli ingredienti confermati. */
export async function leggiPokeDaCasa(db: Db): Promise<{ config: PokeConfig; allergeni: AllergeniVoci } | null> {
  const config = await leggiPokeConfig(db)
  if (!config || !pokeOrdinabile(config)) return null
  const allergeni = await leggiAllergeniPoke(db,config)
  return allergeni.confermati ? { config,allergeni: allergeni.voci } : null
}
/** Ordini attivi da casa per fascia, nel giorno `oggi` di Roma. */
export async function occupazioneFasce(db: Db, oggi: string): Promise<Occupazione[]> {
  const righe = await db.query<{ fascia: Date; totale: number; domicilio: number }>(`select fascia,count(*)::int as totale,count(*) filter (where tipo='domicilio')::int as domicilio
    from ordini where tipo<>'tavolo' and stato=any($1::text[]) and fascia >= $2 and fascia < $3 group by fascia`,[STATI_ATTIVI_CASA,istanteRoma(oggi,0),istanteRoma(oggi,24 * 60)])
  return righe.map(r => ({ fascia: new Date(r.fascia).toISOString(),totale: r.totale,domicilio: r.domicilio }))
}
/** Tutto quello che serve per sapere se e quando si può ordinare adesso. Da usare anche dentro la transazione d'invio. */
export async function leggiDisponibilita(db: Db, adesso: Date, prova: boolean): Promise<DisponibilitaCasa> {
  const oggi = dataRoma(adesso), giorno = giornoSettimana(oggi)
  const [impostazioni,completi,chiuso,zone,occupazione,turniAsporto,turniDomicilio] = [await leggiImpostazioni(db),await allergeniCompleti(db),await chiusoIl(db,oggi),
    await elencoZone(db,true),await occupazioneFasce(db,oggi),await turniDelGiorno(db,'asporto',giorno),await turniDelGiorno(db,'domicilio',giorno)]
  const regole: RegoleFasce = { capacitaFascia: impostazioni.capacitaFascia,capacitaConsegne: impostazioni.capacitaConsegne,anticipoMinuti: impostazioni.anticipoMinuti }
  const turni = { asporto: turniAsporto,domicilio: turniDomicilio }
  const servizi = Object.fromEntries(SERVIZI.map(s => {
    const fasce = fascePrenotabili(s,fasceDelGiorno(oggi,turni[s]),occupazione,regole,adesso).map(f => f.toISOString())
    const apertura = aperturaServizio(s,{ allergeniCompleti: completi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,oggi,chiusoOggi: chiuso,zoneAttive: zone.length,fasceLibere: fasce.length,prova })
    return [s,{ apertura,fasce: apertura.aperto ? fasce : [] }]
  })) as Record<Servizio,DisponibilitaServizio>
  return { oggi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,regole,zone,servizi }
}
```


**Crea** `src/app/(cliente)/ordina/azioni.ts` con:

```ts
'use server'
import { headers } from 'next/headers'
import { db } from '@/server/db'
import { validaCarrello } from '@/domain/carrello'
import { validaCheckout, type ErroriCheckout } from '@/domain/checkout'
import { modalitaProva } from '@/domain/apertura-casa'
import { ipDaHeaders } from '@/domain/ip-client'
import { creaOrdineCasa } from '@/casa/ordini-casa-repo'
import { avviaInvioEmail } from '@/casa/avvia-email'
export interface EsitoCheckout {
  ok: boolean; token?: string; numero?: number; errore?: string; errori?: ErroriCheckout
  nonDisponibili?: string[]; nonDisponibiliIds?: string[]; fasce?: string[]; totaleCent?: number
}
/** Invio dell'ordine da casa. `json`: `{ righe, dati, totaleVistoCent, chiaveInvio }`; il server ricalcola tutto. */
export async function inviaOrdineCasa(json: string): Promise<EsitoCheckout> {
  if (typeof json !== 'string' || json.length > 100000) return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' }
  let input: unknown
  try { input = JSON.parse(json) } catch { return { ok: false,errore: 'Ordine non valido: ricarica la pagina e riprova.' } }
  const v = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string,unknown> : {}
  const dati = validaCheckout(v.dati && typeof v.dati === 'object' && !Array.isArray(v.dati) ? v.dati as Record<string,unknown> : {})
  if (!dati.ok) return { ok: false,errore: 'Controlla i campi evidenziati.',errori: dati.errori }
  const carrello = validaCarrello(v.righe)
  if (!carrello.ok) return { ok: false,errore: carrello.errore }
  try {
    const esito = await creaOrdineCasa(db,{ righe: carrello.righe,dati: dati.dati,totaleVistoCent: v.totaleVistoCent as number,chiaveInvio: v.chiaveInvio as string,
      rete: ipDaHeaders(await headers()),adesso: new Date(),prova: modalitaProva(process.env) })
    if (!esito.ok) {
      const { campo,ok,...resto } = esito
      return { ok,...resto,...(campo && campo !== 'carrello' ? { errori: { [campo]: esito.errore } } : {}) }
    }
    avviaInvioEmail()
    return { ok: true,token: esito.ordine.token,numero: esito.ordine.numero }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' }
  }
}
```


**Crea** `src/app/(cliente)/OrdineInCorso.tsx` con:

```tsx
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CHIAVE_ULTIMO_ORDINE, leggiUltimoOrdine, type UltimoOrdine } from '@/ordinare/archivio-casa'
/** Link all'ultimo ordine fatto da questo browser nelle ultime 12 ore. */
export function OrdineInCorso() {
  const [ordine,setOrdine] = useState<UltimoOrdine | null>(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Lettura da localStorage dopo l'hydration.
      setOrdine(leggiUltimoOrdine(localStorage.getItem(CHIAVE_ULTIMO_ORDINE),Date.now()))
    } catch { /* Senza storage niente link. */ }
  },[])
  if (!ordine) return null
  return <p className="casa-avviso"><Link className="ds-link" href={`/ordine/${ordine.token}`}>Hai un ordine in corso (n. {ordine.numero}): guarda lo stato</Link></p>
}
/** Salva l'ordine come «in corso» in questo browser (anche quando si arriva dal link dell'email). */
export function RicordaOrdine({ token,numero }: { token: string; numero: number }) {
  useEffect(() => {
    try {
      const attuale = leggiUltimoOrdine(localStorage.getItem(CHIAVE_ULTIMO_ORDINE),Date.now())
      if (attuale?.token !== token) localStorage.setItem(CHIAVE_ULTIMO_ORDINE,JSON.stringify({ token,numero,salvatoIl: Date.now() }))
    } catch { /* Facoltativo. */ }
  },[token,numero])
  return null
}
```


**Crea** `src/app/(cliente)/MenuCasa.tsx` con:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { AllergeniVoci } from '@/domain/allergeni-poke'
import type { SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import { CHIAVE_CARRELLO_CASA } from '@/ordinare/archivio-casa'
/** Menù ordinabile da casa: il carrello resta nel browser e si conferma nella pagina del riepilogo. */
export function MenuCasa({ categorie,poke }: { categorie: CategoriaConPiatti[]; poke: { config: PokeConfig; allergeni: AllergeniVoci } | null }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASA,'local')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const modificaPiatto = (id: string,q: number) => { setErrore(c.modificaPiatto(id,q)) }
  const aggiungiPoke = (scelte: SceltePoke) => { const e = c.aggiungiPoke(scelte); setErrore(e); if (!e) setPokeAperta(false) }
  return <>
    {errore && <p role="alert" className="tavolo-avviso">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={poke && <div className="ds-card tavolo-poke-card"><h3 className="heading-sm">Componi la tua poke</h3><p>Da {formatEuro(poke.config.prezzoBaseCent!)}, con ingredienti a tua scelta.</p><button className="ds-btn ds-btn--secondary" type="button" onClick={() => setPokeAperta(true)}>Componi la tua poke</button></div>} />
    {poke && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke config={poke.config} allergeni={poke.allergeni} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,poke?.config ?? null)} modifica={(i,q) => c.modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))}
      nota={(i,nota) => c.modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={async () => { router.push('/ordina'); return true }} inCorso={!c.caricato} errore={null} azione="Vai al riepilogo" />
  </>
}
```


**Sostituisci tutto il contenuto** di `src/app/(cliente)/page.tsx` con:

```tsx
import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { MenuCliente } from '@/menu/componenti/MenuCliente'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { MenuCasa } from './MenuCasa'
import { OrdineInCorso } from './OrdineInCorso'
import '@/app/tavolo/[chiave]/tavolo.css'
import './casa.css'

export default async function Home() {
  await connection() // sempre dal database: prezzi e disponibilità cambiano durante il servizio
  const categorie = await leggiMenu(db)
  const disponibilita = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const { asporto,domicilio } = disponibilita.servizi
  const aperto = asporto.apertura.aperto || domicilio.apertura.aperto
  const poke = aperto ? await leggiPokeDaCasa(db) : null
  return (
    <main className={aperto ? 'contenitore tavolo-pagina' : 'contenitore'}>
      <h1 className="display">Il menù</h1>
      <OrdineInCorso />
      {aperto ? <MenuCasa categorie={categorie} poke={poke} /> : <>
        <p className="casa-avviso" role="status">{!asporto.apertura.aperto && TESTO_MOTIVO[asporto.apertura.motivo]} Il menù resta consultabile.</p>
        <MenuCliente categorie={categorie} />
      </>}
    </main>
  )
}
```


**Crea** `src/app/(cliente)/ordina/Checkout.tsx` con:

```tsx
'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Piatto } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { Zona } from '@/casa/impostazioni-repo'
import type { Servizio } from '@/domain/fasce'
import { totaliCasa, type CampoCheckout, type ErroriCheckout } from '@/domain/checkout'
import { aggiornaCarrello } from '@/domain/carrello-salvato'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { totaleVista, vistaCarrello } from '@/ordinare/vista-carrello'
import { CHIAVE_CARRELLO_CASA, CHIAVE_ULTIMO_ORDINE } from '@/ordinare/archivio-casa'
import { inviaOrdineCasa } from './azioni'
export interface ServizioCheckout { aperto: boolean; motivo: string | null; fasce: string[] }
export interface DisponibilitaCheckout { servizi: Record<Servizio,ServizioCheckout>; zone: Zona[] }
const ERRORE_INCERTO = 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'
function Errore({ campo,errori }: { campo: CampoCheckout; errori: ErroriCheckout }) {
  return errori[campo] ? <p className="casa-errore" id={`errore-${campo}`}>{errori[campo]}</p> : null
}
export function Checkout({ piatti,poke,disponibilita: d }: { piatti: Piatto[]; poke: PokeConfig | null; disponibilita: DisponibilitaCheckout }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASA,'local')
  const router = useRouter()
  const [tipo,setTipo] = useState<Servizio>(d.servizi.asporto.aperto || !d.servizi.domicilio.aperto ? 'asporto' : 'domicilio')
  const [campi,setCampi] = useState({ zonaId: '',indirizzo: '',noteConsegna: '',fascia: '',nome: '',telefono: '',email: '',pagamento: '',contantiDa: '' })
  const [privacy,setPrivacy] = useState(false)
  const [fasceNuove,setFasceNuove] = useState<Partial<Record<Servizio,string[]>>>({})
  const [errori,setErrori] = useState<ErroriCheckout>({})
  const [errore,setErrore] = useState<string | null>(null)
  const [inviato,setInviato] = useState(false)
  const [inCorso,startTransition] = useTransition()
  const imposta = (campo: keyof typeof campi) => (e: { target: { value: string } }) => setCampi(v => ({ ...v,[campo]: e.target.value }))
  const servizio = d.servizi[tipo]
  const fasce = fasceNuove[tipo] ?? servizio.fasce
  const fascia = fasce.includes(campi.fascia) ? campi.fascia : ''
  const righe = c.carrello.righe
  const vista = vistaCarrello(righe,piatti,poke)
  const nonDisponibili = righe.filter(r => r.piattoId !== null && !piatti.find(p => p.id === r.piattoId)?.disponibile)
  const zona = tipo === 'domicilio' ? d.zone.find(z => z.id === campi.zonaId) ?? null : null
  const totali = totaliCasa(totaleVista(vista),tipo,zona)
  const bloccato = !righe.length || vista.some(r => r.daRicomporre) || nonDisponibili.length > 0 || totali.mancanteCent > 0 || !servizio.aperto
  const togliNonDisponibili = () => c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || piatti.find(p => p.id === r.piattoId)?.disponibile),() => crypto.randomUUID()))
  const invia = (e: React.FormEvent) => {
    e.preventDefault()
    if (bloccato || !c.blocca()) return
    setErrore(null); setErrori({})
    const dati = { tipo,...campi,fascia,privacy }
    startTransition(async () => {
      try {
        const esito = await inviaOrdineCasa(JSON.stringify({ righe: c.ref.current.righe,dati,totaleVistoCent: totali.totaleCent,chiaveInvio: c.ref.current.chiaveInvio }))
        if (esito.ok && esito.token) {
          setInviato(true); c.svuota()
          try { localStorage.setItem(CHIAVE_ULTIMO_ORDINE,JSON.stringify({ token: esito.token,numero: esito.numero,salvatoIl: Date.now() })) } catch { /* Facoltativo. */ }
          router.push(`/ordine/${esito.token}`)
          return
        }
        setErrore(esito.errore ?? 'Invio non riuscito, riprova.'); setErrori(esito.errori ?? {})
        if (esito.fasce) setFasceNuove(f => ({ ...f,[tipo]: esito.fasce }))
        if (esito.nonDisponibiliIds) c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || !esito.nonDisponibiliIds!.includes(r.piattoId)),() => crypto.randomUUID()))
        if (esito.totaleCent !== undefined || esito.nonDisponibiliIds) router.refresh()
      } catch { setErrore(ERRORE_INCERTO) }
      finally { c.sblocca() }
    })
  }
  if (inviato) return <p role="status" className="casa-avviso">Ordine inviato: ti portiamo alla pagina dell’ordine…</p>
  if (c.caricato && !righe.length) return <div className="casa-avviso"><p>Il carrello è vuoto.</p><Link className="ds-link" href="/">Scegli i piatti dal menù</Link></div>
  const attesa = inCorso || !c.caricato
  return <form className="casa-modulo" onSubmit={invia} noValidate>
    <p><Link className="ds-link" href="/">← Torna al menù per modificare il carrello</Link></p>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Come vuoi ricevere l’ordine?</legend>
      {(['asporto','domicilio'] as const).map(s => <label key={s} className="tavolo-scelta"><input type="radio" name="tipo" value={s} checked={tipo === s} disabled={!d.servizi[s].aperto || attesa} onChange={() => setTipo(s)} />
        {s === 'asporto' ? 'Ritiro al locale (asporto)' : 'Consegna a domicilio'}{!d.servizi[s].aperto && d.servizi[s].motivo && <span className="casa-nota"> · {d.servizi[s].motivo}</span>}</label>)}
      <Errore campo="tipo" errori={errori} />
    </fieldset>
    {tipo === 'domicilio' && <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Dove lo consegniamo?</legend>
      <label className="campo">Zona<select value={campi.zonaId} onChange={imposta('zonaId')} disabled={attesa} aria-invalid={!!errori.zonaId}>
        <option value="">Scegli la zona</option>{d.zone.map(z => <option key={z.id} value={z.id}>{z.nome} · consegna {formatEuro(z.costoCent)} · minimo {formatEuro(z.minimoCent)}</option>)}</select></label>
      <Errore campo="zonaId" errori={errori} />
      <label className="campo">Indirizzo e numero civico<input value={campi.indirizzo} onChange={imposta('indirizzo')} maxLength={200} autoComplete="street-address" disabled={attesa} aria-invalid={!!errori.indirizzo} /></label>
      <Errore campo="indirizzo" errori={errori} />
      <label className="campo">Citofono, piano, note per il fattorino (facoltativo)<textarea value={campi.noteConsegna} onChange={imposta('noteConsegna')} maxLength={200} rows={2} disabled={attesa} /></label>
      <Errore campo="noteConsegna" errori={errori} />
    </fieldset>}
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Quando?</legend>
      {fasce.length ? <label className="campo">{tipo === 'domicilio' ? 'Consegna verso le' : 'Ritiro alle'}<select value={fascia} onChange={imposta('fascia')} disabled={attesa} aria-invalid={!!errori.fascia}>
        <option value="">Scegli l’orario</option>{fasce.map(f => <option key={f} value={f}>{oraRoma(new Date(f))}</option>)}</select></label> : <p>Nessun orario libero per oggi.</p>}
      <Errore campo="fascia" errori={errori} />
    </fieldset>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">I tuoi dati</legend>
      <label className="campo">Nome<input value={campi.nome} onChange={imposta('nome')} maxLength={60} autoComplete="name" disabled={attesa} aria-invalid={!!errori.nome} /></label>
      <Errore campo="nome" errori={errori} />
      <label className="campo">Telefono<input type="tel" value={campi.telefono} onChange={imposta('telefono')} maxLength={20} autoComplete="tel" disabled={attesa} aria-invalid={!!errori.telefono} /></label>
      <Errore campo="telefono" errori={errori} />
      <label className="campo">Email (per la conferma)<input type="email" value={campi.email} onChange={imposta('email')} maxLength={254} autoComplete="email" disabled={attesa} aria-invalid={!!errori.email} /></label>
      <Errore campo="email" errori={errori} />
    </fieldset>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Come paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}?</legend>
      <label className="tavolo-scelta"><input type="radio" name="pagamento" value="contanti" checked={campi.pagamento === 'contanti'} disabled={attesa} onChange={imposta('pagamento')} />Contanti</label>
      <label className="tavolo-scelta"><input type="radio" name="pagamento" value="carta" checked={campi.pagamento === 'carta'} disabled={attesa} onChange={imposta('pagamento')} />Carta (POS)</label>
      <Errore campo="pagamento" errori={errori} />
      {campi.pagamento === 'contanti' && <label className="campo">Paghi con (facoltativo, per il resto)<input inputMode="decimal" value={campi.contantiDa} onChange={imposta('contantiDa')} placeholder="es. 50" disabled={attesa} aria-invalid={!!errori.contantiDa} /></label>}
      <Errore campo="contantiDa" errori={errori} />
    </fieldset>
    <section className="ds-card casa-sezione" aria-labelledby="riepilogo-titolo"><h2 id="riepilogo-titolo" className="heading-sm">Riepilogo</h2>
      <ul className="casa-riepilogo">{vista.map((r,i) => <li key={`${r.piattoId}-${i}`}><span>{r.quantita} × {r.nome}{r.nota && <span className="casa-nota"> · {r.nota}</span>}</span><span>{r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</span></li>)}
        {tipo === 'domicilio' && zona && <li><span>Consegna · {zona.nome}</span><span>{formatEuro(totali.consegnaCent)}</span></li>}</ul>
      <p className="casa-totale"><span>Totale</span><strong>{formatEuro(totali.totaleCent)}</strong></p>
      <p>Paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}. Nessun pagamento online.</p>
      {vista.some(r => r.daRicomporre) && <p role="alert" className="casa-errore">La poke composta non si può ordinare online in questo momento: tornando al menù, rimuovila dal carrello.</p>}
      {nonDisponibili.length > 0 && <div role="alert"><p className="casa-errore">Alcuni piatti non sono più disponibili.</p><button type="button" className="ds-btn ds-btn--secondary" onClick={togliNonDisponibili}>Togli i piatti non disponibili</button></div>}
      {totali.mancanteCent > 0 && zona && <p role="alert" className="casa-errore">Mancano {formatEuro(totali.mancanteCent)} per l’ordine minimo di {zona.nome}.</p>}
    </section>
    <label className="tavolo-scelta"><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} disabled={attesa} aria-invalid={!!errori.privacy} /><span>Ho letto l’<Link className="ds-link" href="/privacy" target="_blank">informativa privacy</Link></span></label>
    <Errore campo="privacy" errori={errori} />
    {errore && <p role="alert" className="casa-avviso">{errore}</p>}
    <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={attesa || bloccato}>{inCorso ? 'Invio in corso…' : `Conferma l’ordine · ${formatEuro(totali.totaleCent)}`}</button>
  </form>
}
```


**Crea** `src/app/(cliente)/ordina/page.tsx` con:

```tsx
import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { SERVIZI } from '@/domain/fasce'
import { Checkout, type DisponibilitaCheckout } from './Checkout'
import '@/app/tavolo/[chiave]/tavolo.css'
import '../casa.css'
export default async function PaginaOrdina() {
  await connection()
  const categorie = await leggiMenu(db)
  const d = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const poke = await leggiPokeDaCasa(db)
  const disponibilita: DisponibilitaCheckout = {
    zone: d.zone,
    servizi: Object.fromEntries(SERVIZI.map(s => { const a = d.servizi[s].apertura; return [s,{ aperto: a.aperto,motivo: a.aperto ? null : TESTO_MOTIVO[a.motivo],fasce: d.servizi[s].fasce }] })) as DisponibilitaCheckout['servizi'],
  }
  return <main className="contenitore casa-pagina">
    <h1 className="heading">Il tuo ordine</h1>
    <Checkout piatti={categorie.flatMap(c => c.piatti)} poke={poke?.config ?? null} disponibilita={disponibilita} />
  </main>
}
```


**Crea** `src/app/(cliente)/ordine/[token]/StatoOrdine.tsx` con:

```tsx
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, etichettaClienteCasa } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
export const STATI_FINALI = ['rifiutato','annullato','completato'] as const
export function ordineConcluso(stato: string): boolean { return (STATI_FINALI as readonly string[]).includes(stato) }
export function StatoOrdine({ ordine: o,telefono,ora }: { ordine: OrdineCasaClient; telefono: string | null; ora: string }) {
  if (o.anonimizzato) return <p className="casa-avviso">Ordine non più disponibile.</p>
  const orario = oraRoma(new Date(o.fascia)), domicilio = o.tipo === 'domicilio'
  const chiama = telefono && <a className="ds-link" href={`tel:${telefono}`}>{telefono}</a>
  return <>
    <h1 className="heading">Ordine n. {o.numero}</h1>
    <section className="ds-card casa-sezione casa-stato" aria-live="polite">
      <p className="heading-sm" role="status">{etichettaClienteCasa(o.tipo,o.stato)}</p>
      {o.stato === 'in_attesa' && (attesaLunga(o.creatoIl,new Date(ora))
        ? <p className="casa-avviso">Non abbiamo ancora risposto: {chiama ? <>chiamaci al {chiama}.</> : 'chiama il locale.'}</p>
        : <p>Aspettiamo la conferma del locale: questa pagina si aggiorna da sola.</p>)}
      {o.stato === 'in_attesa' && <p>Orario richiesto: {domicilio ? 'consegna verso le' : 'ritiro alle'} {orario}</p>}
      {['accettato','in_preparazione','pronto','in_consegna'].includes(o.stato) && <p><strong>{domicilio ? `Consegna verso le ${orario}` : `Ritiro alle ${orario} in Via Beato Giacomo 72, Bitetto`}</strong></p>}
      {o.stato === 'rifiutato' && <p>Non possiamo accettare l’ordine{o.motivoRifiuto ? `: ${o.motivoRifiuto}` : '.'}</p>}
      {domicilio && o.indirizzo && <p>{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}</p>}
    </section>
    <section className="ds-card casa-sezione" aria-labelledby="riepilogo-ordine"><h2 id="riepilogo-ordine" className="heading-sm">Riepilogo</h2>
      <DettaglioRighe righe={o.righe} area="tavolo" />
      {o.consegnaCent > 0 && <p>Consegna: {formatEuro(o.consegnaCent)}</p>}
      <p className="casa-totale"><span>Totale</span><strong>{formatEuro(o.totaleCent)}</strong></p>
      <p>Paghi {domicilio ? 'alla consegna' : 'al ritiro'} {o.pagamento === 'carta' ? 'con carta' : `in contanti${o.contantiDaCent ? ` (con ${formatEuro(o.contantiDaCent)})` : ''}`}.</p>
    </section>
    {chiama && <p>Per qualsiasi domanda chiamaci al {chiama}.</p>}
  </>
}
```


**Crea** `src/app/(cliente)/ordine/[token]/page.tsx` con:

```tsx
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { ordineCasaPerToken, perClient } from '@/casa/ordini-casa-repo'
import { leggiImpostazioni } from '@/casa/impostazioni-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { RicordaOrdine } from '../../OrdineInCorso'
import { StatoOrdine, ordineConcluso } from './StatoOrdine'
import '@/app/tavolo/[chiave]/tavolo.css'
import '../../casa.css'
export default async function PaginaStatoOrdine({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ordine = await ordineCasaPerToken(db,token)
  if (!ordine) notFound()
  const { telefono } = await leggiImpostazioni(db)
  const ora = new Date().toISOString(), concluso = ordineConcluso(ordine.stato)
  return <main className="contenitore casa-pagina">
    {!concluso && <><AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={ora} /><RicordaOrdine token={ordine.token} numero={ordine.numero} /></>}
    <StatoOrdine ordine={perClient(ordine)} telefono={telefono} ora={ora} />
  </main>
}
```


**Crea** `src/app/(cliente)/privacy/page.tsx` con:

```tsx
import Link from 'next/link'
import '../casa.css'
// Testo provvisorio: va sostituito con quello fornito e validato dal locale (spec §6 e §9).
export default function Privacy() {
  return <main className="contenitore casa-pagina casa-testo">
    <h1 className="heading">Informativa privacy</h1>
    <p className="casa-avviso">Testo provvisorio, da validare dal locale prima di aprire gli ordini online.</p>
    <p>Titolare del trattamento è Daniel’s Sushi, Via Beato Giacomo 72, Bitetto (BA).</p>
    <h2 className="heading-sm">Quali dati raccogliamo</h2>
    <p>Per gli ordini da asporto e a domicilio raccogliamo solo i dati che servono a prepararli e consegnarli: nome, telefono, email e, per il domicilio, indirizzo e note per il fattorino. Registriamo anche l’indirizzo di rete da cui arriva l’ordine, per limitare gli abusi.</p>
    <h2 className="heading-sm">Perché li usiamo</h2>
    <p>Per gestire il tuo ordine: confermarlo, prepararlo, consegnarlo e avvisarti via email dei cambi di stato. Non li usiamo per pubblicità e non li cediamo ad altri.</p>
    <h2 className="heading-sm">Per quanto tempo</h2>
    <p>Dopo 12 mesi i dati personali degli ordini vengono cancellati; restano solo importi e piatti, in forma anonima, per le statistiche del locale.</p>
    <h2 className="heading-sm">Chi li tratta per noi</h2>
    <p>I dati sono conservati sui server dei fornitori dell’applicazione (hosting, database e invio delle email), che li trattano solo per nostro conto.</p>
    <h2 className="heading-sm">I tuoi diritti</h2>
    <p>Puoi chiedere di vedere, correggere o cancellare i tuoi dati scrivendoci o chiamando il locale.</p>
    <p><Link className="ds-link" href="/">Torna al menù</Link></p>
  </main>
}
```


**Crea** `src/app/(cliente)/casa.css` con:

```css
.casa-pagina { display: grid; gap: var(--sp-24); padding-block: var(--sp-16) var(--sp-48); }
.casa-modulo { display: grid; gap: var(--sp-24); max-width: 640px; }
.casa-sezione { display: grid; gap: var(--sp-16); padding: var(--sp-24); margin: 0; min-width: 0; border: 0; overflow-wrap: anywhere; }
.casa-sezione legend { float: left; width: 100%; margin-bottom: var(--sp-8); }
.casa-sezione input:not([type=radio]):not([type=checkbox]), .casa-sezione select, .casa-sezione textarea { min-width: 0; width: 100%; }
.casa-avviso { margin: 0; padding: var(--sp-16); border-left: var(--sp-4) solid var(--arancio); background: var(--bianco); border-radius: var(--radius-card); overflow-wrap: anywhere; }
.casa-errore { margin: 0; color: var(--distruttivo); font-size: .9375rem; }
.casa-nota { color: var(--inchiostro-tenue); }
.casa-riepilogo { display: grid; gap: var(--sp-8); margin: 0; padding: 0; list-style: none; }
.casa-riepilogo li, .casa-totale { display: flex; justify-content: space-between; gap: var(--sp-16); }
.casa-riepilogo li > span:last-child, .casa-totale strong { flex-shrink: 0; white-space: nowrap; overflow-wrap: normal; }
.casa-totale { margin: 0; padding-top: var(--sp-8); border-top: var(--hairline) solid var(--filetto); font-size: 1.125rem; }
.casa-stato .heading-sm { margin: 0; }
.casa-testo { max-width: 720px; }
@media (max-width: 480px) { .casa-sezione { padding: var(--sp-16); } }
```


- [x] **Step 4:** stesso comando → atteso **3 file, 8 test verdi**; `npm run typecheck`; `npm run lint`.
- [x] **Step 5: commit** — `git add -A "src/app/(cliente)" src/ordinare src/casa/disponibilita.ts && git commit -m "Cliente da casa: menù ordinabile, checkout, pagina dello stato e informativa privacy"`

---

### Task 11: Schermo staff — ordini online, da accettare con suono, cucina su tre colonne

**File:**
- in `src/app/staff/`: crea `OrdiniCasa.tsx` e `azioni-casa.ts` (+test);
- modifica `SchermoStaff.tsx`, `SchermoStaff.test.tsx`, `page.tsx`, `page.test.tsx` e `staff.css`.

Le azioni dello staff non chiamano `after()`: ogni azione fa `router.refresh()`, e il rendering di `/staff` chiama `avviaInvioEmail()`, che invia le email appena accodate e ritenta quelle fallite.

**Interfacce prodotte:**
- azioni `apriOrdiniOnline`, `chiudiOrdiniOnline`, `accettaOrdineStaff(id,ritardo)`, `rifiutaOrdineStaff(id,motivo,altro)`, `avanzaOrdineCasaStaff(id,da)`, `annullaOrdineCasaStaff(id)`;
- `DatiStaff` con `casa` e `ordiniOnline`.

- [x] **Step 1: test**

**Crea** `src/app/staff/azioni-casa.test.ts` con:

```ts
import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), revalidatePath: vi.fn(), impostaApertura: vi.fn(), accettaOrdine: vi.fn(), rifiutaOrdine: vi.fn(), avanzaOrdineCasa: vi.fn(), annullaOrdineCasa: vi.fn() }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('@/casa/impostazioni-repo', () => ({ impostaApertura: m.impostaApertura }))
vi.mock('@/casa/ordini-casa-repo', () => ({ accettaOrdine: m.accettaOrdine, rifiutaOrdine: m.rifiutaOrdine, avanzaOrdineCasa: m.avanzaOrdineCasa, annullaOrdineCasa: m.annullaOrdineCasa }))
import { accettaOrdineStaff, annullaOrdineCasaStaff, apriOrdiniOnline, avanzaOrdineCasaStaff, chiudiOrdiniOnline, rifiutaOrdineStaff } from './azioni-casa'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); for (const f of [m.accettaOrdine,m.rifiutaOrdine,m.avanzaOrdineCasa,m.annullaOrdineCasa]) f.mockResolvedValue({ id }) })
it('apertura e chiusura degli ordini online di oggi (data di Roma)', async () => {
  vi.useFakeTimers({ now: new Date('2026-10-12T22:30:00Z') })
  try { expect(await apriOrdiniOnline()).toEqual({ ok: true }) } finally { vi.useRealTimers() }
  expect(m.impostaApertura).toHaveBeenCalledWith({},'2026-10-13')
  expect(await chiudiOrdiniOnline()).toEqual({ ok: true }); expect(m.impostaApertura).toHaveBeenLastCalledWith({},null)
  expect(m.revalidatePath).toHaveBeenCalledWith('/ordina')
})
it('ogni azione verifica lo staff prima del repository', async () => {
  const azioni = [() => apriOrdiniOnline(),() => accettaOrdineStaff(id,15),() => rifiutaOrdineStaff(id,'Fascia piena',''),() => avanzaOrdineCasaStaff(id,'accettato'),() => annullaOrdineCasaStaff(id)]
  for (const a of azioni) { m.richiediRuolo.mockClear(); expect(await a()).toEqual({ ok: true }); expect(m.richiediRuolo).toHaveBeenCalledWith('staff') }
  expect(m.accettaOrdine).toHaveBeenCalledWith({},id,15)
  expect(m.rifiutaOrdine).toHaveBeenCalledWith({},id,'Fascia piena')
  expect(m.avanzaOrdineCasa).toHaveBeenCalledWith({},id,'accettato')
  m.richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
  for (const a of azioni) await expect(a()).rejects.toThrow('NEXT_REDIRECT')
})
it('valori non validi non arrivano al repository', async () => {
  expect((await accettaOrdineStaff(id,20)).ok).toBe(false)
  expect((await accettaOrdineStaff('x',0)).ok).toBe(false)
  expect(await rifiutaOrdineStaff(id,'Altro','  ')).toEqual({ ok: false,errore: 'Scegli un motivo, oppure scrivilo in «Altro».' })
  expect((await avanzaOrdineCasaStaff(id,'servito')).ok).toBe(false)
  expect((await annullaOrdineCasaStaff('x')).ok).toBe(false)
  expect(m.accettaOrdine).not.toHaveBeenCalled(); expect(m.rifiutaOrdine).not.toHaveBeenCalled(); expect(m.avanzaOrdineCasa).not.toHaveBeenCalled(); expect(m.annullaOrdineCasa).not.toHaveBeenCalled()
  expect(await rifiutaOrdineStaff(id,'Altro',' Manca il fattorino ')).toEqual({ ok: true }); expect(m.rifiutaOrdine).toHaveBeenCalledWith({},id,'Manca il fattorino')
})
it('ordine già cambiato da un altro tablet ed errori del DB', async () => {
  m.accettaOrdine.mockResolvedValueOnce(null)
  expect(await accettaOrdineStaff(id,0)).toEqual({ ok: false,errore: 'Operazione non disponibile: aggiorna lo schermo.' })
  m.annullaOrdineCasa.mockRejectedValueOnce(new Error('connessione'))
  expect(await annullaOrdineCasaStaff(id)).toEqual({ ok: false,errore: 'Operazione non riuscita, riprova.' })
})
```


**Sostituisci tutto il contenuto** di `src/app/staff/SchermoStaff.test.tsx` con:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ apriTavolo: vi.fn(), chiudiTavolo: vi.fn(), avanzaOrdine: vi.fn(), annullaOrdineStaff: vi.fn(), annullaRigaStaff: vi.fn() }))
vi.mock('./azioni-casa', () => ({ apriOrdiniOnline: vi.fn(), chiudiOrdiniOnline: vi.fn(), accettaOrdineStaff: vi.fn(), rifiutaOrdineStaff: vi.fn(), avanzaOrdineCasaStaff: vi.fn(), annullaOrdineCasaStaff: vi.fn() }))
import { CardOrdine } from './SchermoStaff'
import { CardOrdineCasa } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import type { OrdineClient } from '@/tavoli/ordini-repo'
const online = { accesi: true,asporto: null,domicilio: 'Consegne a domicilio non disponibili.' }
const tavolo: OrdineClient = { id: 'o',numero: 8,stato: 'inviato',totaleCent: 900,creatoIl: '2026-10-11T18:00:00Z',sessioneId: 's',tavoloNome: 'Tavolo 1',tavoloChiuso: false,righe: [{ id: 'r',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: 'senza sesamo',poke: { Base: ['Riso'],Proteine: ['Tonno'] },annullata: false },{ id: 'r2',numero: 2,nome: 'Salmone',prezzoUnitCent: 600,quantita: 1,nota: null,poke: null,annullata: true }] }
const casa: OrdineCasaClient = { id: 'c',numero: 9,tipo: 'domicilio',stato: 'in_attesa',token: 't'.repeat(32),totaleCent: 2000,consegnaCent: 200,fascia: '2026-10-11T17:30:00.000Z',creatoIl: '2026-10-11T17:00:00.000Z',
  clienteNome: 'Anna',clienteTelefono: '3331234567',clienteEmail: 'anna@esempio.it',zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi',pagamento: 'contanti',contantiDaCent: 5000,motivoRifiuto: null,anonimizzato: false,
  righe: [{ id: 'rc',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 3,nota: null,poke: null,annullata: false }] }
it('evidenzia note e poke, barra annullati e mostra tempo e stato', () => {
  const html = renderToStaticMarkup(<CardOrdine ordine={tavolo} ora="2026-10-11T18:05:00Z" nuovo={true} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).toContain('staff-ordine--nuovo'); expect(html).toContain('senza sesamo'); expect(html).toContain('staff-nota'); expect(html).toContain('Tonno'); expect(html).toContain('<s>'); expect(html).toContain('5 min'); expect(html).toContain('In preparazione')
})
it('senza dati e senza dati precedenti mostra il caricamento invece di smontarsi', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  expect(renderToStaticMarkup(<SchermoStaff dati={null} ora="2026-10-11T18:05:00Z" />)).toContain('Caricamento dello schermo')
  const html = renderToStaticMarkup(<SchermoStaff dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [],casa: [],ordiniOnline: { ...online,accesi: false } }} ora="2026-10-11T18:05:00Z" />)
  expect(html).toContain('Cucina'); expect(html).toContain('Nessun tavolo configurato'); expect(html).toContain('Ordini online: chiusi'); expect(html).toContain('Apri ordini di oggi'); expect(html).toContain('Nessun ordine da accettare')
})
it('ordine da accettare: orario di Roma, cliente, indirizzo, pagamento e i quattro bottoni; evidenziato dopo 10 minuti', () => {
  const html = renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:05:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)
  expect(html).toContain('Domicilio 19:30 · n. 9'); expect(html).toContain('href="tel:3331234567"'); expect(html).toContain('Via Roma 1 · Bitetto · citofono Rossi'); expect(html).toContain('Contanti (paga con 50,00 €)')
  for (const b of ['>Accetta<','Accetta +15’','Accetta +30’','>Rifiuta<']) expect(html).toContain(b)
  expect(html).not.toContain('staff-ordine--attesa')
  expect(renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:11:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)).toContain('In attesa da più di 10 minuti')
})
it('cucina: tavoli e casa insieme per orario, con il passaggio giusto per la casa', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T17:05:00Z" dati={{ tavoli: [],riepiloghi: [],contiRecenti: [],ordiniOnline: online,
    ordini: [tavolo],casa: [{ ...casa,stato: 'accettato' },{ ...casa,id: 'c2',numero: 10,tipo: 'asporto',stato: 'pronto',fascia: '2026-10-11T17:45:00.000Z' },{ ...casa,id: 'c3',numero: 11 }] }} />)
  expect(html).toContain('Ordini online: aperti oggi'); expect(html).toContain('Domicilio: Consegne a domicilio non disponibili.')
  expect(html.indexOf('Domicilio 19:30 · n. 9')).toBeLessThan(html.indexOf('Tavolo 1 · n. 8'))
  expect(html).toContain('Pronti e in consegna'); expect(html).toContain('>Ritirato<')
  expect(html.match(/Accetta \+15/g)).toHaveLength(1)
})
```


**Sostituisci tutto il contenuto** di `src/app/staff/page.test.tsx` con:

```tsx
import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
const m = vi.hoisted(() => ({ ruolo: vi.fn(),elenco: vi.fn(),ordini: vi.fn(),riepiloghi: vi.fn(),conti: vi.fn(),casa: vi.fn(),disponibilita: vi.fn(),email: vi.fn() }))
vi.mock('@/auth/sessione',() => ({ richiediRuolo: m.ruolo }))
vi.mock('@/server/db',() => ({ db: {} }))
vi.mock('@/tavoli/repo',() => ({ elencoTavoli: m.elenco,contiRecenti: m.conti }))
vi.mock('@/tavoli/ordini-repo',() => ({ ordiniAttivi: m.ordini,riepiloghiTavoli: m.riepiloghi }))
vi.mock('@/app/accesso/azioni',() => ({ esci: vi.fn() }))
vi.mock('@/casa/ordini-casa-repo',() => ({ ordiniCasaAttivi: m.casa,perClient: (o: object) => o }))
vi.mock('@/casa/disponibilita',() => ({ leggiDisponibilita: m.disponibilita }))
vi.mock('@/casa/avvia-email',() => ({ avviaInvioEmail: m.email }))
vi.mock('next/navigation',async originale => ({ ...await originale<typeof import('next/navigation')>(),useRouter: () => ({ refresh: vi.fn() }) }))
import { redirect } from 'next/navigation'
import AreaStaff from './page'
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.elenco.mockResolvedValue([]); m.ordini.mockResolvedValue([]); m.riepiloghi.mockResolvedValue([]); m.conti.mockResolvedValue([]); m.casa.mockResolvedValue([])
  m.disponibilita.mockResolvedValue({ oggi: '2026-10-12',apertiIl: '2026-10-12',servizi: { asporto: { apertura: { aperto: true } },domicilio: { apertura: { aperto: false,motivo: 'zone' } } } }) })
it('mantiene intestazione e tentativi automatici se falliscono le letture DB', async () => {
  m.elenco.mockRejectedValueOnce(new Error('DB giù'))
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).toContain('Area staff'); expect(html).toContain('Database non raggiungibile, riprovo da solo')
  // InizioTurno resta montato anche quando la lettura fallisce.
  expect(html).toContain('Inizia turno')
})
it('con i dati letti non mostra il banner di errore', async () => {
  const html = renderToStaticMarkup(await AreaStaff())
  expect(html).not.toContain('Database non raggiungibile'); expect(html).toContain('Inizia turno')
  // Lo schermo ritenta le email in coda a ogni aggiornamento riuscito.
  expect(m.email).toHaveBeenCalledTimes(1)
})
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


- [x] **Step 2:** `npx vitest run src/app/staff` → atteso **FAIL**.
- [x] **Step 3: codice**

**Crea** `src/app/staff/azioni-casa.ts` con:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { impostaApertura } from '@/casa/impostazioni-repo'
import { accettaOrdine, annullaOrdineCasa, avanzaOrdineCasa, rifiutaOrdine } from '@/casa/ordini-casa-repo'
import { motivoRifiuto, STATI_CASA, type StatoCasa } from '@/domain/stati-casa'
import { dataRoma } from '@/domain/ora-roma'
import { idValido } from '@/tavoli/validazione'
import type { EsitoStaff } from './azioni'
// Le email accodate partono al rendering successivo di /staff (router.refresh dopo ogni azione).
async function operazione(fn: () => Promise<unknown>): Promise<EsitoStaff> {
  let risultato: unknown
  try { risultato = await fn() } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  if (risultato === null) return { ok: false,errore: 'Operazione non disponibile: aggiorna lo schermo.' }
  revalidatePath('/staff'); revalidatePath('/'); revalidatePath('/ordina'); revalidatePath('/ordine/[token]','page')
  return { ok: true }
}
export async function apriOrdiniOnline(): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return operazione(() => impostaApertura(db,dataRoma(new Date())))
}
export async function chiudiOrdiniOnline(): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  return operazione(() => impostaApertura(db,null))
}
export async function accettaOrdineStaff(id: string, ritardo: number): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id) || (ritardo !== 0 && ritardo !== 15 && ritardo !== 30)) return { ok: false,errore: 'Ordine o ritardo non valido.' }
  return operazione(() => accettaOrdine(db,id,ritardo))
}
export async function rifiutaOrdineStaff(id: string, motivo: string, altro: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  const testo = motivoRifiuto(motivo,altro)
  if (!idValido(id)) return { ok: false,errore: 'Ordine non valido.' }
  if (!testo) return { ok: false,errore: 'Scegli un motivo, oppure scrivilo in «Altro».' }
  return operazione(() => rifiutaOrdine(db,id,testo))
}
export async function avanzaOrdineCasaStaff(id: string, da: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id) || !(STATI_CASA as readonly string[]).includes(da)) return { ok: false,errore: 'Ordine non valido.' }
  return operazione(() => avanzaOrdineCasa(db,id,da as StatoCasa))
}
export async function annullaOrdineCasaStaff(id: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(id)) return { ok: false,errore: 'Ordine non valido.' }
  return operazione(() => annullaOrdineCasa(db,id))
}
```


**Crea** `src/app/staff/OrdiniCasa.tsx` con:

```tsx
'use client'
import { useState } from 'react'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, azioneAvanzaCasa, MOTIVI_RIFIUTO } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { Pannello } from '@/componenti/Pannello'
import type { EsitoStaff } from './azioni'
import { annullaRigaStaff } from './azioni'
import { accettaOrdineStaff, annullaOrdineCasaStaff, apriOrdiniOnline, avanzaOrdineCasaStaff, chiudiOrdiniOnline, rifiutaOrdineStaff } from './azioni-casa'
type Esegui = (azione: () => Promise<EsitoStaff>) => void
export interface OrdiniOnline { accesi: boolean; asporto: string | null; domicilio: string | null }
export function PannelloOrdiniOnline({ stato,inCorso,esegui }: { stato: OrdiniOnline; inCorso: boolean; esegui: Esegui }) {
  return <section className="ds-card staff-online" aria-labelledby="ordini-online"><h2 id="ordini-online" className="heading-sm">Ordini online: {stato.accesi ? 'aperti oggi' : 'chiusi'}</h2>
    {stato.accesi && <ul className="staff-online-stato"><li>Asporto: {stato.asporto ?? 'si può ordinare'}</li><li>Domicilio: {stato.domicilio ?? 'si può ordinare'}</li></ul>}
    {stato.accesi ? <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(chiudiOrdiniOnline)}>Chiudi ordini online</button>
      : <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(apriOrdiniOnline)}>Apri ordini di oggi</button>}
  </section>
}
function RifiutaOrdine({ ordine,inCorso,esegui }: { ordine: OrdineCasaClient; inCorso: boolean; esegui: Esegui }) {
  const [aperto,setAperto] = useState(false)
  const [motivo,setMotivo] = useState('')
  const [altro,setAltro] = useState('')
  return <>
    <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => setAperto(true)}>Rifiuta</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo={`Rifiuta l’ordine n. ${ordine.numero}`}>
      <fieldset className="staff-motivi"><legend>Motivo, che il cliente leggerà</legend>
        {[...MOTIVI_RIFIUTO,'Altro'].map(m => <label key={m}><input type="radio" name={`motivo-${ordine.id}`} value={m} checked={motivo === m} onChange={() => setMotivo(m)} />{m}</label>)}
      </fieldset>
      {motivo === 'Altro' && <label className="campo">Scrivi il motivo<textarea maxLength={200} rows={2} value={altro} onChange={e => setAltro(e.target.value)} /></label>}
      <div className="conferma-azioni">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAperto(false)}>Annulla</button>
        <button type="button" className="ds-btn ds-btn--destructive" disabled={inCorso || !motivo || (motivo === 'Altro' && !altro.trim())} onClick={() => { setAperto(false); esegui(() => rifiutaOrdineStaff(ordine.id,motivo,altro)) }}>Rifiuta ordine</button>
      </div>
    </Pannello>
  </>
}
/** Ordine da casa: `daAccettare` mostra accetta/rifiuta, altrimenti i passaggi della cucina. */
export function CardOrdineCasa({ ordine: o,ora,inCorso,esegui,daAccettare }: { ordine: OrdineCasaClient; ora: string; inCorso: boolean; esegui: Esegui; daAccettare: boolean }) {
  const lunga = daAccettare && attesaLunga(o.creatoIl,new Date(ora))
  const avanza = azioneAvanzaCasa(o.tipo,o.stato)
  return <article className={`ds-card staff-ordine${daAccettare ? ' staff-ordine--nuovo' : ''}${lunga ? ' staff-ordine--attesa' : ''}`}>
    <h3 className="heading-sm">{o.tipo === 'domicilio' ? 'Domicilio' : 'Asporto'} {oraRoma(new Date(o.fascia))} · n. {o.numero}</h3>
    {lunga && <p className="staff-nota"><strong>In attesa da più di 10 minuti</strong></p>}
    <p>{o.clienteNome} · {o.clienteTelefono && <a className="ds-link" href={`tel:${o.clienteTelefono}`}>{o.clienteTelefono}</a>} · {formatEuro(o.totaleCent)} · {o.pagamento === 'carta' ? 'Carta' : `Contanti${o.contantiDaCent ? ` (paga con ${formatEuro(o.contantiDaCent)})` : ''}`}</p>
    {o.tipo === 'domicilio' && <p className="staff-nota">{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}{o.consegnaCent > 0 && ` · consegna ${formatEuro(o.consegnaCent)}`}</p>}
    <DettaglioRighe righe={o.righe} area="staff" azioneRiga={daAccettare ? undefined : r => <ConfermaAzione inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => esegui(() => annullaRigaStaff(r.id))}>Annulla<span className="visually-hidden"> {r.nome}</span></ConfermaAzione>} />
    <div className="staff-azioni">{daAccettare ? <>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,0))}>Accetta</button>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,15))}>Accetta +15’</button>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,30))}>Accetta +30’</button>
      <RifiutaOrdine ordine={o} inCorso={inCorso} esegui={esegui} />
    </> : <>
      {avanza && <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => avanzaOrdineCasaStaff(o.id,o.stato))}>{avanza}</button>}
      <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}? Il cliente riceverà un’email.`} conferma={() => esegui(() => annullaOrdineCasaStaff(o.id))}>Annulla ordine</ConfermaAzione>
    </>}</div>
  </article>
}
```


**Modifica** `src/app/staff/SchermoStaff.tsx` (1 di 3): sostituisci

```tsx
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { SuonoTurno } from './InizioTurno'
import { ChiudiTavolo } from './ChiudiTavolo'
import { apriTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, type EsitoStaff } from './azioni'

type Esegui = (azione: () => Promise<EsitoStaff>) => void
```

con

```tsx
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { SuonoTurno } from './InizioTurno'
import { ChiudiTavolo } from './ChiudiTavolo'
import { CardOrdineCasa, PannelloOrdiniOnline, type OrdiniOnline } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { colonnaCucina } from '@/domain/stati-casa'
import { apriTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, type EsitoStaff } from './azioni'

type Esegui = (azione: () => Promise<EsitoStaff>) => void
```

**Modifica** `src/app/staff/SchermoStaff.tsx` (2 di 3): sostituisci

```tsx
    </div>
  </article>
}
export interface DatiStaff { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[] }
const CHIAVE_ARRIVI = 'ds_arrivi_cucina'
function arriviSalvati(): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(CHIAVE_ARRIVI)) } catch { return null }
```

con

```tsx
    </div>
  </article>
}
export interface DatiStaff { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[]; casa: OrdineCasaClient[]; ordiniOnline: OrdiniOnline }
const CHIAVE_ARRIVI = 'ds_arrivi_cucina'
function arriviSalvati(): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(CHIAVE_ARRIVI)) } catch { return null }
```

**Modifica** `src/app/staff/SchermoStaff.tsx` (3 di 3): sostituisci

```tsx
      finally { bloccato.current = false }
    })
  }
  if (!mostrati || !ordini) return <p role="status">Caricamento dello schermo…</p>
  const { tavoli,riepiloghi,contiRecenti } = mostrati
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
    <section><h2 className="heading">Cucina</h2><div className="staff-colonne">{(['inviato','in_preparazione'] as const).map(stato => <section key={stato}>
      <h3 className="heading-sm">{stato === 'inviato' ? 'Inviati' : 'In preparazione'}</h3>
      {!ordini.some(o => o.stato === stato) && <p>Nessun ordine.</p>}
      {ordini.filter(o => o.stato === stato).map(o => <CardOrdine key={o.id} ordine={o} ora={ora} nuovo={nuovi.includes(o.id)} inCorso={inCorso} leggi={() => leggi(o.id)} esegui={esegui} />)}
    </section>)}</div></section>
    <section><h2 className="heading">Tavoli</h2>{!tavoli.length && <p>Nessun tavolo configurato. Chiedi all’admin di aggiungerli.</p>}<div className="staff-tavoli">{tavoli.filter(t => t.attivo || t.sessione).map(t => {
      const s = t.sessione, r = riepiloghi.find(r => r.sessioneId === s?.id)
      return <article className="ds-card staff-tavolo" key={t.id}><h3 className="heading-sm">{t.nome}</h3>{s ? <>
```

con

```tsx
      finally { bloccato.current = false }
    })
  }
  // Suono ripetuto ogni 10 secondi finché c'è un ordine da casa da accettare; subito quando ne arriva uno nuovo.
  const inAttesa = (mostrati?.casa ?? []).filter(o => o.stato === 'in_attesa').map(o => o.id).join(',')
  useEffect(() => {
    if (!inAttesa) return
    suona(3)
    const timer = setInterval(() => suona(3),10000)
    return () => clearInterval(timer)
  },[inAttesa,suona])
  if (!mostrati || !ordini) return <p role="status">Caricamento dello schermo…</p>
  const { tavoli,riepiloghi,contiRecenti,casa,ordiniOnline } = mostrati
  // Tavoli e casa nella stessa cucina: la casa per orario della fascia, i tavoli per arrivo.
  const cucina = [...ordini.map(o => ({ casa: false as const,o,quando: o.creatoIl })),...casa.filter(o => colonnaCucina(o.stato)).map(o => ({ casa: true as const,o,quando: o.fascia }))]
    .sort((a,b) => a.quando.localeCompare(b.quando))
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
    <PannelloOrdiniOnline stato={ordiniOnline} inCorso={inCorso} esegui={esegui} />
    <section><h2 className="heading">Da accettare</h2>{!inAttesa && <p>Nessun ordine da accettare.</p>}
      <div className="staff-tavoli">{casa.filter(o => o.stato === 'in_attesa').map(o => <CardOrdineCasa key={o.id} ordine={o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare />)}</div></section>
    <section><h2 className="heading">Cucina</h2><div className="staff-colonne staff-colonne--tre">{(['da_preparare','in_preparazione','pronti'] as const).map(colonna => { const qui = cucina.filter(x => colonnaCucina(x.o.stato) === colonna)
      return <section key={colonna}>
        <h3 className="heading-sm">{{ da_preparare: 'Da preparare',in_preparazione: 'In preparazione',pronti: 'Pronti e in consegna' }[colonna]}</h3>
        {!qui.length && <p>Nessun ordine.</p>}
        {qui.map(x => x.casa ? <CardOrdineCasa key={x.o.id} ordine={x.o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare={false} />
          : <CardOrdine key={x.o.id} ordine={x.o} ora={ora} nuovo={nuovi.includes(x.o.id)} inCorso={inCorso} leggi={() => leggi(x.o.id)} esegui={esegui} />)}
      </section> })}</div></section>
    <section><h2 className="heading">Tavoli</h2>{!tavoli.length && <p>Nessun tavolo configurato. Chiedi all’admin di aggiungerli.</p>}<div className="staff-tavoli">{tavoli.filter(t => t.attivo || t.sessione).map(t => {
      const s = t.sessione, r = riepiloghi.find(r => r.sessioneId === s?.id)
      return <article className="ds-card staff-tavolo" key={t.id}><h3 className="heading-sm">{t.nome}</h3>{s ? <>
```


**Modifica** `src/app/staff/page.tsx` (1 di 2): sostituisci

```tsx
import { elencoTavoli, contiRecenti } from '@/tavoli/repo'
import { ordiniAttivi, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { InizioTurno } from './InizioTurno'
import { SchermoStaff } from './SchermoStaff'
import './staff.css'
```

con

```tsx
import { elencoTavoli, contiRecenti } from '@/tavoli/repo'
import { ordiniAttivi, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { ordiniCasaAttivi, perClient } from '@/casa/ordini-casa-repo'
import { leggiDisponibilita } from '@/casa/disponibilita'
import { avviaInvioEmail } from '@/casa/avvia-email'
import { modalitaProva, TESTO_MOTIVO, type StatoApertura } from '@/domain/apertura-casa'
import { InizioTurno } from './InizioTurno'
import { SchermoStaff } from './SchermoStaff'
import './staff.css'
```

**Modifica** `src/app/staff/page.tsx` (2 di 2): sostituisci

```tsx
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)])
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
  const ora = new Date().toISOString()
  const datiStaff = dati ? {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
  } : null
  return (
    <main className="contenitore staff-pagina">
```

con

```tsx
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db),ordiniCasaAttivi(db),leggiDisponibilita(db,new Date(),modalitaProva(process.env))])
    // Ogni aggiornamento dello schermo ritenta anche le email rimaste in coda.
    avviaInvioEmail()
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
  const ora = new Date().toISOString()
  const motivo = (a: StatoApertura) => a.aperto ? null : TESTO_MOTIVO[a.motivo]
  const datiStaff = dati ? {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
    casa: dati[4].map(perClient),
    ordiniOnline: { accesi: dati[5].apertiIl === dati[5].oggi,asporto: motivo(dati[5].servizi.asporto.apertura),domicilio: motivo(dati[5].servizi.domicilio.apertura) },
  } : null
  return (
    <main className="contenitore staff-pagina">
```


**Sostituisci tutto il contenuto** di `src/app/staff/staff.css` con:

```css
.staff-pagina { display: grid; gap: var(--sp-24); padding-block: var(--sp-24); }
.staff-barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-16); }
.staff-colonne { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: var(--sp-24); }
.staff-tavoli { display: grid; grid-template-columns: repeat(auto-fill,minmax(min(100%,280px),1fr)); gap: var(--sp-24); }
.staff-ordine, .staff-tavolo { padding: var(--sp-24); margin-bottom: var(--sp-16); overflow-wrap: anywhere; }
.staff-ordine--nuovo { border: var(--sp-4) solid var(--arancio); }
.staff-azioni { display: flex; flex-wrap: wrap; gap: var(--sp-8); }
.staff-azioni .ds-btn { min-height: var(--tap); }
.staff-righe { padding-left: var(--sp-24); display: grid; gap: var(--sp-16); }
.staff-nota { border-left: var(--sp-4) solid var(--arancio); padding-left: var(--sp-12); color: var(--inchiostro); }
.staff-nota p { margin-block: var(--sp-4); }
.staff-codice { margin-block: var(--sp-24); font-variant-numeric: tabular-nums; }
.staff-conto { width: 100%; border-collapse: collapse; table-layout: fixed; }
.staff-conto th, .staff-conto td { padding: var(--sp-8); border-bottom: var(--hairline) solid var(--filetto); text-align: left; overflow-wrap: anywhere; }
.staff-conto th:first-child { width: 12%; }
.staff-conto-poke { color: var(--inchiostro-tenue); font-size: .8125rem; }
.staff-conto-poke p { margin-block: var(--sp-4); }
.staff-conto .ds-btn { white-space: normal; padding-inline: var(--sp-8); }
.staff-conti-recenti { display: grid; gap: var(--sp-16); padding-left: var(--sp-24); overflow-wrap: anywhere; }
@media (max-width: 640px) { .staff-colonne { grid-template-columns: minmax(0,1fr); } .staff-ordine, .staff-tavolo { padding: var(--sp-16); } .staff-conto { font-size: 1rem; } .staff-conto th, .staff-conto td { padding: var(--sp-4); } }

.staff-conto { background: var(--bianco); }
.staff-conto th, .staff-conto td { padding: 12px; }
.staff-conto th { font-size: .9375rem; color: var(--inchiostro-tenue); }
.staff-navigazione { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.staff-navigazione .ds-link { padding-inline: 12px; }
.staff-codice { font-variant-numeric: tabular-nums; letter-spacing: .08em; font-size: 2.125rem; }
@media (max-width: 50rem) { .staff-colonne { grid-template-columns: minmax(0,1fr); } }
@media (max-width: 40rem) { .staff-conto { font-size: 1rem; } .staff-conto th, .staff-conto td { padding: 4px; } }


@media print { .staff-navigazione, .staff-barra, .staff-conto button, .staff-conto dialog { display: none; } .staff-conto tr { break-inside: avoid; } }
.staff-colonne--tre { grid-template-columns: repeat(3,minmax(0,1fr)); }
.staff-ordine--attesa { border: var(--sp-4) solid var(--distruttivo); }
.staff-online { display: grid; gap: var(--sp-12); padding: var(--sp-24); }
.staff-online-stato { margin: 0; padding-left: var(--sp-24); }
.staff-motivi { display: grid; gap: var(--sp-8); border: 0; padding: 0; margin: 0 0 var(--sp-16); min-width: 0; }
.staff-motivi label { display: flex; align-items: center; gap: var(--sp-12); min-height: var(--tap); }
.staff-motivi input { accent-color: var(--indaco); }
.staff-motivi + .campo textarea { min-width: 0; width: 100%; }
@media (max-width: 64rem) { .staff-colonne--tre { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 50rem) { .staff-colonne--tre { grid-template-columns: minmax(0,1fr); } }
```


- [x] **Step 4:** `npx vitest run src/app/staff` → atteso tutto verde (azioni-casa: 4 test, SchermoStaff: 4, page: 4, più quelli già esistenti). Poi `npm run typecheck` e `npm run lint`.
- [x] **Step 5: commit** — `git add src/app/staff && git commit -m "Schermo staff: ordini online, da accettare con suono e cucina su tre colonne"`

---

### Task 12: Anonimizzazione giornaliera, variabili e documentazione

**File:**
- crea `src/casa/cron.ts` (+test), `src/app/api/cron/anonimizza/route.ts` (+test) e `vercel.json`;
- modifica `.env.example` e `README.md`.

- [x] **Step 1: test**

**Crea** `src/casa/cron.test.ts` con:

```ts
import { expect, it } from 'vitest'
import { autorizzatoCron } from './cron'
const segreto = 'abcdefghijklmnop1234'
it('solo con il segreto giusto, preceduto da Bearer, e lungo almeno 16 caratteri', () => {
  expect(autorizzatoCron(`Bearer ${segreto}`,segreto)).toBe(true)
  expect(autorizzatoCron(segreto,segreto)).toBe(false)
  expect(autorizzatoCron(`Bearer ${segreto}x`,segreto)).toBe(false)
  expect(autorizzatoCron(null,segreto)).toBe(false)
  expect(autorizzatoCron('Bearer ',undefined)).toBe(false)
  expect(autorizzatoCron('Bearer corto','corto')).toBe(false)
})
```


**Crea** `src/app/api/cron/anonimizza/route.test.ts` con:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ anonimizza: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/casa/ordini-casa-repo', () => ({ anonimizzaOrdiniCasa: m.anonimizza }))
import { GET } from './route'
const segreto = 'abcdefghijklmnop1234'
const richiesta = (auth?: string) => new Request('http://localhost/api/cron/anonimizza',{ headers: auth ? { authorization: auth } : {} })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); vi.stubEnv('CRON_SECRET',segreto) })
afterEach(() => { vi.unstubAllEnvs() })
it('senza il segreto giusto risponde 401 e non tocca il database', async () => {
  expect((await GET(richiesta())).status).toBe(401)
  expect((await GET(richiesta('Bearer sbagliato'))).status).toBe(401)
  vi.stubEnv('CRON_SECRET','')
  expect((await GET(richiesta('Bearer '))).status).toBe(401)
  expect(m.anonimizza).not.toHaveBeenCalled()
})
it('con il segreto anonimizza e dice quanti ordini; errore del DB → 500', async () => {
  m.anonimizza.mockResolvedValueOnce(3)
  const ok = await GET(richiesta(`Bearer ${segreto}`))
  expect(ok.status).toBe(200); expect(await ok.json()).toEqual({ anonimizzati: 3 })
  m.anonimizza.mockRejectedValueOnce(new Error('connessione'))
  expect((await GET(richiesta(`Bearer ${segreto}`))).status).toBe(500)
})
```


- [x] **Step 2:** `npx vitest run src/casa/cron.test.ts src/app/api` → atteso **FAIL**.
- [x] **Step 3: codice e configurazione**

**Crea** `src/casa/cron.ts` con:

```ts
import { timingSafeEqual } from 'node:crypto'
/** Vercel invia `Authorization: Bearer <CRON_SECRET>`. Senza un segreto di almeno 16 caratteri non passa nessuno. */
export function autorizzatoCron(intestazione: string | null, segreto: string | undefined): boolean {
  if (!segreto || segreto.length < 16 || !intestazione) return false
  const atteso = Buffer.from(`Bearer ${segreto}`), ricevuto = Buffer.from(intestazione)
  return atteso.length === ricevuto.length && timingSafeEqual(atteso,ricevuto)
}
```


**Crea** `src/app/api/cron/anonimizza/route.ts` con:

```ts
import { db } from '@/server/db'
import { anonimizzaOrdiniCasa } from '@/casa/ordini-casa-repo'
import { autorizzatoCron } from '@/casa/cron'
export const dynamic = 'force-dynamic'
// Chiamata ogni giorno dal cron di Vercel (vercel.json). Idempotente: una chiamata doppia o saltata non fa danni.
export async function GET(request: Request) {
  if (!autorizzatoCron(request.headers.get('authorization'),process.env.CRON_SECRET)) return new Response('Non autorizzato',{ status: 401 })
  try {
    return Response.json({ anonimizzati: await anonimizzaOrdiniCasa(db,new Date()) },{ headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return Response.json({ errore: 'Anonimizzazione non riuscita' },{ status: 500 })
  }
}
```


**Crea** `vercel.json` con:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/anonimizza", "schedule": "0 3 * * *" }]
}
```


**Sostituisci tutto il contenuto** di `.env.example` con:

```bash
# Supabase → Project Settings → API
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
# Supabase → Connect → Transaction pooler (porta 6543)
DATABASE_URL=
# URL assoluto dell'app per i QR (opzionale, es. https://ordini.esempio.it).
# Se assente viene usato l'host della richiesta.
APP_URL=
# Email ai clienti con Resend (facoltative: senza, le email restano spente).
# EMAIL_MITTENTE esempio: Daniel's Sushi <ordini@tuodominio.it> (dominio verificato su Resend).
# I link nelle email usano APP_URL, che quindi serve anche per le email.
RESEND_API_KEY=
EMAIL_MITTENTE=
# Segreto del cron di anonimizzazione (almeno 16 caratteri), da impostare anche su Vercel.
CRON_SECRET=
# Solo in locale: 1 permette di provare gli ordini da casa senza allergeni confermati. Ignorata in produzione.
ORDINI_CASA_PROVA=
```


**Modifica** `README.md` (1 di 4): sostituisci

```markdown

- **Tappa 1**: base del progetto, menù pubblico con allergeni, accesso admin/staff e gestione del menù.
- **Tappa 2**: tavoli, QR, codice del cameriere, carrello con note e poke, cucina e conto.
- **Tappa 3**: asporto e domicilio, ancora da implementare.

Documentazione di progetto:

- Specifica: [`docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`](docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md)
- Piani di lavoro: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Requisiti
```

con

```markdown

- **Tappa 1**: base del progetto, menù pubblico con allergeni, accesso admin/staff e gestione del menù.
- **Tappa 2**: tavoli, QR, codice del cameriere, carrello con note e poke, cucina e conto.
- **Tappa 3**: asporto e domicilio: zone, orari, fasce, checkout, accettazione con suono, pagina dello stato ed email.

Documentazione di progetto:

- Specifica: [`docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`](docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md)
- Specifica della tappa 3: [`docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md`](docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md)
- Piani di lavoro: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Requisiti
```

**Modifica** `README.md` (2 di 4): sostituisci

```markdown
   | `SUPABASE_URL` | Supabase → Project Settings → API |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database |
   | `APP_URL` (opzionale) | URL assoluto dell'app per i QR, es. `https://ordini.esempio.it`; se assente viene usato l'host della richiesta |

   Queste variabili sono lette solo dal server e non finiscono mai nel browser. Non committare `.env.local`.
```

con

```markdown
   | `SUPABASE_URL` | Supabase → Project Settings → API |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database |
   | `APP_URL` (opzionale) | URL assoluto dell'app per i QR e per i link nelle email, es. `https://ordini.esempio.it`; se assente i QR usano l'host della richiesta e le email restano spente |
   | `RESEND_API_KEY` (opzionale) | Resend → API Keys; senza, le email ai clienti restano spente |
   | `EMAIL_MITTENTE` (opzionale) | mittente su un dominio verificato in Resend, es. `Daniel's Sushi <ordini@tuodominio.it>` |
   | `CRON_SECRET` (opzionale) | stringa casuale di almeno 16 caratteri; su Vercel protegge il cron di anonimizzazione |
   | `ORDINI_CASA_PROVA` (solo locale) | `1` per provare gli ordini da casa senza allergeni confermati; ignorata in produzione |

   Queste variabili sono lette solo dal server e non finiscono mai nel browser. Non committare `.env.local`.
```

**Modifica** `README.md` (3 di 4): sostituisci

```markdown

| Percorso | Contenuto |
| --- | --- |
| `/` | menù pubblico |
| `/accesso` | accesso per admin e staff |
| `/admin/menu` | gestione del menù (admin) |
| `/admin/poke` | prezzi e regole della poke (admin) |
| `/admin/tavoli` | gestione tavoli (admin) |
| `/admin/tavoli/stampa` | QR dei tavoli attivi (admin) |
| `/staff` | cucina e apertura/chiusura tavoli |
```

con

```markdown

| Percorso | Contenuto |
| --- | --- |
| `/` | menù pubblico, ordinabile quando gli ordini da casa sono aperti |
| `/ordina` | riepilogo e conferma dell'ordine da casa |
| `/ordine/[token]` | stato dell'ordine da casa, aggiornato da solo |
| `/privacy` | informativa privacy (testo provvisorio) |
| `/accesso` | accesso per admin e staff |
| `/admin/menu` | gestione del menù (admin) |
| `/admin/poke` | prezzi, regole e allergeni degli ingredienti della poke (admin) |
| `/admin/domicilio` | impostazioni, zone, orari e chiusure degli ordini da casa (admin) |
| `/api/cron/anonimizza` | anonimizzazione giornaliera (solo con `CRON_SECRET`) |
| `/admin/tavoli` | gestione tavoli (admin) |
| `/admin/tavoli/stampa` | QR dei tavoli attivi (admin) |
| `/staff` | cucina e apertura/chiusura tavoli |
```

**Modifica** `README.md` (4 di 4): sostituisci

```markdown

Lo schermo staff si aggiorna ogni 5 secondi e il tavolo ogni 10. L'aggiornamento si ferma nelle schede nascoste e riparte subito quando tornano visibili o torna la connessione. Prima del refresh viene controllata la connessione con `GET /stato`, senza DB: se manca, la schermata resta visibile con l’ora dell’ultimo aggiornamento e riprende automaticamente. Il browser non legge mai il database: viene usato `router.refresh()`, senza Supabase Realtime o policy di lettura API. `cacheComponents` resta disabilitato. I test SQL usano PGlite con tutte le migrazioni reali e transazioni, senza Docker. PGlite serializza le transazioni e non prova la concorrenza reale: in Postgres le garanzie dipendono dagli indici unici e dai lock.

## Allergeni

Per la vendita a distanza il Reg. UE 1169/2011, art. 14, impone che le informazioni sugli allergeni siano disponibili prima dell'acquisto. Per questo gli ordini da casa non partono finché tutti i piatti non hanno gli allergeni confermati.
```

con

```markdown

Lo schermo staff si aggiorna ogni 5 secondi e il tavolo ogni 10. L'aggiornamento si ferma nelle schede nascoste e riparte subito quando tornano visibili o torna la connessione. Prima del refresh viene controllata la connessione con `GET /stato`, senza DB: se manca, la schermata resta visibile con l’ora dell’ultimo aggiornamento e riprende automaticamente. Il browser non legge mai il database: viene usato `router.refresh()`, senza Supabase Realtime o policy di lettura API. `cacheComponents` resta disabilitato. I test SQL usano PGlite con tutte le migrazioni reali e transazioni, senza Docker. PGlite serializza le transazioni e non prova la concorrenza reale: in Postgres le garanzie dipendono dagli indici unici e dai lock.

## Ordini da casa

Applica la migrazione `20261013120000_domicilio_asporto.sql` dopo le precedenti: aggiunge zone, orari, chiusure, impostazioni e coda delle email, e le colonne degli ordini da casa. Gli ordini dei tavoli restano validi. Anche questa va autorizzata prima di applicarla al database reale.

In `/admin/domicilio` imposta il telefono del locale, gli ordini per fascia di 15 minuti e quanti di questi possono essere a domicilio, l'anticipo minimo, le zone (costo e ordine minimo), i turni di asporto e domicilio per ogni giorno e le chiusure straordinarie. Le zone non si cancellano: si disattivano.

Gli ordini si aprono solo dallo schermo staff con **Apri ordini di oggi**: l'interruttore vale per il giorno in cui si accende e il giorno dopo riparte spento. Servono anche il telefono del locale, gli allergeni confermati e almeno una fascia libera. Il cliente sceglie i piatti in `/`, conferma in `/ordina` (asporto o domicilio, fascia, dati, contanti o carta, privacy) e segue l'ordine in `/ordine/<token>`. Il server ricalcola tutto: se il totale cambia, l'ordine non parte e il riepilogo si aggiorna. Due clienti non possono prendere insieme l'ultimo posto di una fascia: gli invii da casa si mettono in fila sul lock delle impostazioni. Al massimo 3 ordini in attesa per telefono e 10 all'ora per rete.

Sullo schermo staff gli ordini da casa compaiono in **Da accettare** con un suono ogni 10 secondi: **Accetta**, **Accetta +15’**, **Accetta +30’** o **Rifiuta** con motivo. Poi passano nella cucina insieme ai tavoli: **Da preparare**, **In preparazione**, **Pronti e in consegna** (Pronto → Ritirato, oppure Partito → Consegnato).

Le email (ricevuto, accettato, rifiutato, annullato) si accodano nel database e partono subito dopo l'azione; quelle non riuscite si ritentano a ogni aggiornamento dello schermo staff, fino a 5 volte. Servono `RESEND_API_KEY`, `EMAIL_MITTENTE` con un dominio verificato e `APP_URL`; senza, le email restano in coda e l'app funziona lo stesso. Ogni giorno alle 3 il cron di Vercel (`vercel.json`) chiama `/api/cron/anonimizza`, che toglie i dati personali dagli ordini da casa più vecchi di 12 mesi.

## Allergeni

Per la vendita a distanza il Reg. UE 1169/2011, art. 14, impone che le informazioni sugli allergeni siano disponibili prima dell'acquisto. Per questo gli ordini da casa non partono finché tutti i piatti disponibili non hanno gli allergeni confermati, e la poke composta si ordina da casa solo quando in `/admin/poke` sono confermati gli allergeni di tutti gli ingredienti. Per le prove in locale c'è `ORDINI_CASA_PROVA=1`, ignorata in produzione.
```


- [x] **Step 4:** stesso comando → atteso **2 file, 3 test verdi**.
- [x] **Step 5: verifica completa del branch:**
  - `npm test` → atteso **61 file, 283 test verdi**;
  - `npm run typecheck` e `npm run lint` puliti;
  - `npm run build` **senza `.env.local`**: rinominalo temporaneamente, poi rimettilo. Nell'elenco delle route devono comparire `/ordina`, `/ordine/[token]`, `/privacy` (statica), `/admin/domicilio` e `/api/cron/anonimizza`.
- [x] **Step 6: commit** — `git add src/casa/cron.ts src/casa/cron.test.ts src/app/api vercel.json .env.example README.md && git commit -m "Anonimizzazione giornaliera, variabili e documentazione degli ordini da casa"`

---

### Task 13: Sito — bottoni «Ordina» collegati all'app (repo `daniel-sushi`)

**Dove:** il repo del sito, `C:\Users\aless\Desktop\daniel-sushi` (GitHub `carnedasosa/daniel-sushi`).
- `git status` pulito, `git checkout main`, `git pull`, poi `git checkout -b ordina-ora`.
- I file HTML hanno fine riga CRLF: vale la regola 3.

**File:** crea `js/ordini.js`; modifica `index.html`, `menu.html`, `crediti.html`.
- L'indirizzo dell'app resta **vuoto** finché l'app non è pubblicata: con la costante vuota i link restano identici a oggi (`#dove`).
- I tre «Ordina» delle box portano a `/#box`, la categoria Box del menù dell'app.

- [x] **Step 1: codice**

**Crea** `js/ordini.js` con:

```js
// Collega i bottoni «Ordina» all'app degli ordini.
// Scrivi qui l'indirizzo dell'app, per esempio 'https://ordini.danielsushi.it'.
// Finché resta vuoto, i bottoni portano alla sezione «Dove siamo» come prima.
const URL_ORDINI = '';

if (URL_ORDINI) {
  const base = URL_ORDINI.replace(/\/+$/, '');
  // data-ordina vuoto → menù dell'app; data-ordina="box" → categoria Box del menù.
  document.querySelectorAll('a[data-ordina]').forEach((link) => {
    const categoria = link.dataset.ordina;
    link.href = categoria ? `${base}/#${categoria}` : `${base}/`;
  });
}
```


**Modifica** `index.html` (1 di 6): sostituisci

```html
  <link rel="stylesheet" href="design-system/tokens.css">
  <link rel="stylesheet" href="design-system/components/bundle.css">
  <link rel="stylesheet" href="css/site.css">

  <script type="application/ld+json">
  {
```

con

```html
  <link rel="stylesheet" href="design-system/tokens.css">
  <link rel="stylesheet" href="design-system/components/bundle.css">
  <link rel="stylesheet" href="css/site.css">
  <script src="js/ordini.js" defer></script>

  <script type="application/ld+json">
  {
```

**Modifica** `index.html` (2 di 6): sostituisci

```html
        <a href="#poke">Componi la poke</a>
        <a href="#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="#dove">Ordina ora</a>
    </div>
  </header>
```

con

```html
        <a href="#poke">Componi la poke</a>
        <a href="#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="#dove" data-ordina>Ordina ora</a>
    </div>
  </header>
```

**Modifica** `index.html` (3 di 6): sostituisci

```html
          <p class="script hero__script m-enter" style="--i: 2">sushi giapponese, cuore pugliese</p>
          <p class="hero__lead m-enter" style="--i: 3">Roll creativi con stracciatella, pistacchio e mandorla: la cucina giapponese con un accento pugliese.</p>
          <div class="hero__actions m-enter" style="--i: 4">
            <a class="ds-btn ds-btn--primary ds-btn--lg" href="#dove">Ordina ora</a>
            <a class="ds-btn ds-btn--secondary ds-btn--lg" href="menu.html">Sfoglia il menù <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
```

con

```html
          <p class="script hero__script m-enter" style="--i: 2">sushi giapponese, cuore pugliese</p>
          <p class="hero__lead m-enter" style="--i: 3">Roll creativi con stracciatella, pistacchio e mandorla: la cucina giapponese con un accento pugliese.</p>
          <div class="hero__actions m-enter" style="--i: 4">
            <a class="ds-btn ds-btn--primary ds-btn--lg" href="#dove" data-ordina>Ordina ora</a>
            <a class="ds-btn ds-btn--secondary ds-btn--lg" href="menu.html">Sfoglia il menù <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
```

**Modifica** `index.html` (4 di 6): sostituisci

```html
              <p class="caption box-card__meta">49 · 24 pz.</p>
              <h3 class="heading-sm">Small box</h3>
              <p class="box-card__desc">4 pz. Sushi Gio, 2 pz. Nigiri, 8 pz. Uramaki salmone, 8 pz. Uramaki gambero in tempura, 2 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">20,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove">Ordina</a></div>
            </div>
          </article>
          <article class="box-card ds-card m-lift">
```

con

```html
              <p class="caption box-card__meta">49 · 24 pz.</p>
              <h3 class="heading-sm">Small box</h3>
              <p class="box-card__desc">4 pz. Sushi Gio, 2 pz. Nigiri, 8 pz. Uramaki salmone, 8 pz. Uramaki gambero in tempura, 2 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">20,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove" data-ordina="box">Ordina</a></div>
            </div>
          </article>
          <article class="box-card ds-card m-lift">
```

**Modifica** `index.html` (5 di 6): sostituisci

```html
              <p class="caption box-card__meta">50 · 35 pz.</p>
              <h3 class="heading-sm">Medium box</h3>
              <p class="box-card__desc">5 pz. Sashimi, 2 pz. Sushi Gio, 2 pz. Nigiri, 8 pz. Uramaki, 8 pz. Special roll a scelta dello chef, 8 pz. Hosomaki, 2 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">30,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove">Ordina</a></div>
            </div>
          </article>
          <article class="box-card ds-card m-lift">
```

con

```html
              <p class="caption box-card__meta">50 · 35 pz.</p>
              <h3 class="heading-sm">Medium box</h3>
              <p class="box-card__desc">5 pz. Sashimi, 2 pz. Sushi Gio, 2 pz. Nigiri, 8 pz. Uramaki, 8 pz. Special roll a scelta dello chef, 8 pz. Hosomaki, 2 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">30,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove" data-ordina="box">Ordina</a></div>
            </div>
          </article>
          <article class="box-card ds-card m-lift">
```

**Modifica** `index.html` (6 di 6): sostituisci

```html
              <p class="caption box-card__meta">51 · 55 pz.</p>
              <h3 class="heading-sm">Large box</h3>
              <p class="box-card__desc">5 pz. Sashimi, 4 pz. Nigiri salmone, 2 pz. Nigiri tonno, 8 pz. Uramaki, 24 pz. Special roll a scelta dello chef, 8 pz. Hosomaki, 4 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">50,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove">Ordina</a></div>
            </div>
          </article>
        </div>
```

con

```html
              <p class="caption box-card__meta">51 · 55 pz.</p>
              <h3 class="heading-sm">Large box</h3>
              <p class="box-card__desc">5 pz. Sashimi, 4 pz. Nigiri salmone, 2 pz. Nigiri tonno, 8 pz. Uramaki, 24 pz. Special roll a scelta dello chef, 8 pz. Hosomaki, 4 pz. Starter.</p>
              <div class="box-card__foot"><span class="price price--lg">50,00&nbsp;€</span><a class="ds-btn ds-btn--secondary" href="#dove" data-ordina="box">Ordina</a></div>
            </div>
          </article>
        </div>
```


**Modifica** `menu.html` (1 di 2): sostituisci

```html
  <!-- Con JavaScript il menù mostra una categoria alla volta; senza, le mostra tutte. -->
  <script>document.documentElement.classList.add('js');</script>
  <script src="js/menu.js" defer></script>
</head>
<body class="ds">
  <a class="skip-link" href="#contenuto">Vai al contenuto</a>
```

con

```html
  <!-- Con JavaScript il menù mostra una categoria alla volta; senza, le mostra tutte. -->
  <script>document.documentElement.classList.add('js');</script>
  <script src="js/menu.js" defer></script>
  <script src="js/ordini.js" defer></script>
</head>
<body class="ds">
  <a class="skip-link" href="#contenuto">Vai al contenuto</a>
```

**Modifica** `menu.html` (2 di 2): sostituisci

```html
        <a href="index.html#poke">Componi la poke</a>
        <a href="index.html#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="index.html#dove">Ordina ora</a>
    </div>
  </header>
```

con

```html
        <a href="index.html#poke">Componi la poke</a>
        <a href="index.html#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="index.html#dove" data-ordina>Ordina ora</a>
    </div>
  </header>
```


**Modifica** `crediti.html` (1 di 2): sostituisci

```html
  <link rel="stylesheet" href="design-system/tokens.css">
  <link rel="stylesheet" href="design-system/components/bundle.css">
  <link rel="stylesheet" href="css/site.css">
</head>
<body class="ds">
  <a class="skip-link" href="#contenuto">Vai al contenuto</a>
```

con

```html
  <link rel="stylesheet" href="design-system/tokens.css">
  <link rel="stylesheet" href="design-system/components/bundle.css">
  <link rel="stylesheet" href="css/site.css">
  <script src="js/ordini.js" defer></script>
</head>
<body class="ds">
  <a class="skip-link" href="#contenuto">Vai al contenuto</a>
```

**Modifica** `crediti.html` (2 di 2): sostituisci

```html
        <a href="index.html#poke">Componi la poke</a>
        <a href="index.html#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="index.html#dove">Ordina ora</a>
    </div>
  </header>
```

con

```html
        <a href="index.html#poke">Componi la poke</a>
        <a href="index.html#dove">Dove siamo</a>
      </nav>
      <a class="ds-btn ds-btn--primary" href="index.html#dove" data-ordina>Ordina ora</a>
    </div>
  </header>
```


- [x] **Step 2: prova nel browser.**
  - Servi la cartella con un server statico qualsiasi; il protocollo `file://` va bene solo se il browser esegue gli script.
  - Con `URL_ORDINI = ''`, in console `[...document.querySelectorAll('a[data-ordina]')].map(a => a.getAttribute('href'))` → in `index.html` cinque volte `"#dove"`.
  - Metti **temporaneamente** `URL_ORDINI = 'https://ordini.esempio.it/'` e ricarica:
    - `index.html`: due `https://ordini.esempio.it/` e tre `https://ordini.esempio.it/#box`;
    - `menu.html` e `crediti.html`: un `https://ordini.esempio.it/` ciascuna;
    - il menù del sito funziona ancora;
    - nessun errore in console.
  - **Rimetti `''`** prima del commit.
- [x] **Step 3: commit** — `git add js/ordini.js index.html menu.html crediti.html && git commit -m "Bottoni «Ordina» collegati all'app degli ordini (indirizzo in js/ordini.js)"`

---

### Task 14: Migrazione sul DB reale e prova del flusso completo

Il progetto Supabase è `daniel-sushi` (ref `rxsywhdznaugfhmsdjsa`) nell'organizzazione free «daniel sushi». Torna nel repo del gestionale, branch `tappa-3-casa`.

- [x] **Step 1 (sola lettura):** controlla che sul DB reale ci siano esattamente le 3 migrazioni dello «Stato verificato» e nessuna tabella `zone_consegna`.
  - Query: `select version,name from supabase_migrations.schema_migrations order by version;` e `select to_regclass('public.zone_consegna');` (atteso `null`).
  - Se trovi altro, **fermati**.
- [x] **Step 2: chiedi all'utente:** «Posso applicare al database reale la migrazione `20261013120000_domicilio_asporto.sql`? Aggiunge cinque tabelle e alcune colonne agli ordini, cambia i vincoli di `ordini` mantenendo validi gli ordini esistenti, e la registra nella cronologia delle migrazioni nella stessa transazione.» **Solo col suo sì:**
  - esegui in **una sola** chiamata SQL (MCP Supabase `execute_sql`, o uno script locale che usa `DATABASE_URL` da `.env.local` senza stamparla):

    ```sql
    begin;
    -- qui l'intero contenuto di supabase/migrations/20261013120000_domicilio_asporto.sql
    insert into supabase_migrations.schema_migrations (version,name) values ('20261013120000','domicilio_asporto');
    commit;
    ```

  - Poi **(sola lettura)** ricontrolla la cronologia (4 righe), `select count(*) from ordini` (invariato) e gli advisor di sicurezza. Atteso solo «RLS Enabled No Policy» informativo, più il warning Auth già noto «Leaked Password Protection Disabled».
- [x] **Step 3: chiedi all'utente:** «Per la prova nel browser devo, sul database reale:
  - impostare telefono, una zona e un turno in `/admin/domicilio`;
  - aprire gli ordini online;
  - creare 2–3 ordini di prova (con `ORDINI_CASA_PROVA=1` in `.env.local`, solo in locale, perché gli allergeni non sono ancora confermati);
  - alla fine cancellarli, insieme alla zona e al turno di prova, con SQL che ti mostro prima.

  Posso procedere?» **Solo col suo sì:**
  - aggiungi `ORDINI_CASA_PROVA=1` a `.env.local` e avvia `npm run dev`;
  - l'utente fa il login admin;
  - poi verifica e annota l'esito di ogni punto:
  1. `/admin/domicilio`:
     - telefono, capacità 2 e consegne 1, una zona «Prova» (costo 2,00 €, minimo 15,00 €);
     - un turno di asporto e uno di domicilio per **oggi** che copra almeno l'ora successiva;
     - la pagina si apre senza errori.
  2. `/admin/poke`: la sezione allergeni si apre (non confermare nulla sul DB reale).
  3. `/staff`: «Inizia turno», «Apri ordini di oggi» → la scritta diventa «aperti oggi».
  4. In una scheda senza login, `/`:
     - menù ordinabile, poi carrello;
     - «Vai al riepilogo», domicilio sotto il minimo → «Mancano …»;
     - campi vuoti → errori per campo;
     - ordine d'asporto completo → pagina `/ordine/<token>` «In attesa di conferma».
  5. `/staff`:
     - l'ordine compare in «Da accettare» col suono ripetuto;
     - «Accetta +15’» → in cucina all'orario spostato;
     - la pagina del cliente mostra «Confermato» con il nuovo orario entro 10 secondi;
     - poi In preparazione → Pronto → Ritirato.
  6. Secondo ordine a domicilio → «Rifiuta» con «Altro» e un testo → la pagina del cliente mostra il motivo.
  7. Coda email **(sola lettura)**: `select tipo,tentativi,inviata_il from email_ordini;` → righe presenti, `tentativi = 0` (Resend non configurato).
  8. «Chiudi ordini online» → il menù pubblico dice «Ordini online chiusi in questo momento.».
  9. Le pagine nuove a 375 px: nessuno scroll orizzontale.
- [x] **Step 4: pulizia (chiedi prima, mostrando le query):**

  ```sql
  begin;
  delete from ordini where tipo <> 'tavolo';
  delete from orari_casa;
  delete from zone_consegna where nome = 'Prova';
  update impostazioni_casa set aperti_il = null where id = 1;
  commit;
  ```

  (le email della coda si cancellano con gli ordini). Togli `ORDINI_CASA_PROVA=1` da `.env.local`. Il telefono resta solo se l'utente lo conferma come numero vero del locale; altrimenti `update impostazioni_casa set telefono = null where id = 1;`.
- [x] **Step 5: verbale** — crea `docs/verifiche/2026-10-13-tappa-3.md` con:
  - comandi eseguiti e risultati (file e test);
  - esito dei 9 punti della prova;
  - SQL della migrazione e della pulizia, con i conteggi;
  - advisor;
  - eventuali scostamenti dal piano.

  Poi `git add docs/verifiche/2026-10-13-tappa-3.md && git commit -m "Verifica della tappa 3: migrazione reale e prova del flusso da casa"`.

---

### Task 15: Consegna

- [ ] **Step 1:** rileggi il diff del branch contro la spec della tappa 3 (§4, §5, §6) e la Review Focus di questo piano. Se trovi uno scostamento **non lo correggi da solo**: riportalo all'utente.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run lint && npm run build` verdi senza flag.
- [ ] **Step 3:** `git push -u origin tappa-3-casa` e PR verso `main` in italiano, nello stile della PR #3:
  - cosa contiene;
  - verifiche fatte (test, build, prova nel browser);
  - cosa serve prima di aprire al pubblico: allergeni di piatti e ingredienti, telefono, orari, zone, dominio e chiave Resend, testo della privacy, pubblicazione su Vercel con `CRON_SECRET`.
- [ ] **Step 4:** nel repo `daniel-sushi`, `git push -u origin ordina-ora` e PR verso `main`. Nella descrizione: «L'indirizzo dell'app va scritto in `js/ordini.js` quando l'app è pubblicata; fino ad allora non cambia nulla per i visitatori».
- [ ] **Step 5:** **non fare merge.** Riferisci all'utente: commit creati, numero di test, esito della prova, link delle due PR, eventuali scostamenti.

---

## Fuori da questo piano (non farli)

- Storico ordini con filtri in admin, cambio password staff, annullamento da parte del cliente, ordini per i giorni successivi, turni a cavallo della mezzanotte.
- TLS verso il pooler di Supabase (tema separato, decide l'utente).
- Pubblicazione su Vercel, acquisto del dominio, configurazione di Resend: li decide e li fa l'utente.
- Confermare allergeni o inserire dati veri del locale sul DB reale.
