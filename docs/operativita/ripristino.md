# Ripristino del servizio

Per chi deve rimettere in piedi il gestionale durante il servizio. Le affermazioni su Supabase e Vercel sono state controllate sulla documentazione ufficiale il **10/11/2026** (fonti in fondo); prezzi e limiti cambiano, quindi prima di una decisione di spesa vanno riletti alla fonte.

> **Stato di questa procedura.** Il backup manuale e il ripristino su un progetto nuovo (§3 e §4) sono scritti seguendo la documentazione di Supabase ma **non sono mai stati provati su questo progetto**. Finché non si fa una prova generale (vedi [Decisioni per il titolare](#7-decisioni-per-il-titolare)), i tempi e i punti segnati «da verificare» restano tali.

## 1. Che cosa si è rotto

| Sintomo | Dove guardare | Vai a |
| --- | --- | --- |
| Il sito non risponde affatto, nemmeno `/stato` | [vercel-status.com](https://www.vercel-status.com/), Vercel → progetto → Deployments | §5 |
| `/stato` risponde ma menù, staff e tavoli danno errore | Supabase → progetto: è **in pausa**? [status.supabase.com](https://status.supabase.com/) | §2 (pausa), poi §4 |
| Tutto si è rotto subito dopo un deploy | Vercel → Deployments: l'ultimo è di pochi minuti fa | §5 |
| Tutto si è rotto subito dopo una migrazione | l'uscita di `scripts/applica-sql.ts`, i log di Vercel | §6 |
| Dati cancellati o rovinati (ordini, menù, impostazioni) | — | §4 |

`/stato` non tocca il database: se risponde, Vercel e il deploy sono vivi e il problema è dalla parte del database.

## 2. Che cosa offre Supabase oggi (piano Free) e che cosa cambierebbe

Il progetto sta in un'organizzazione sul piano **Free**.

| | Free (oggi) | Pro |
| --- | --- | --- |
| Backup automatici | **Nessuno.** La pagina dei prezzi dice «Automatic backups: not included»; la guida ai backup consiglia ai progetti gratuiti di esportare i dati da soli e tenerne copia altrove | Giornalieri, conservati 7 giorni, ripristinabili dalla dashboard (il progetto resta irraggiungibile durante il ripristino) |
| PITR (ritorno a un istante preciso) | Non disponibile | Componente aggiuntivo a pagamento: circa **100 $/mese** per 7 giorni di finestra (200 $ per 14, 400 $ per 28). Quando è attivo sostituisce i backup giornalieri. Perdita massima dichiarata: 2 minuti |
| Pausa per inattività | **Sì**: un progetto con poca attività sul database per 7 giorni viene messo in pausa. Prima arriva un'email di avviso al proprietario, poi una di conferma | Mai |
| «Restore to a new project» dalla dashboard | Non disponibile | Sì (richiede i backup fisici) |
| Prezzo | 0 | **25 $/mese** per organizzazione, con 10 $ di credito di calcolo che coprono un progetto di taglia Micro |

Conseguenze pratiche sul piano Free:

- **Se il database si rovina, l'unica copia è quella che abbiamo fatto noi** (§3). Senza un backup manuale recente si perde tutto ciò che è successo dopo l'ultimo: ordini, pagamenti, modifiche al menù, foto dei piatti.
- **Pausa.** Con il locale aperto ogni settimana l'attività basta. Il rischio è una chiusura lunga (ferie): al rientro il progetto può essere in pausa e il sito dà errore su tutto tranne `/stato`. Si riattiva da Supabase → organizzazione → progetto → **Resume project**; i dati e la configurazione tornano com'erano. La finestra per farlo è di 1 anno dalla pausa. *Da verificare:* quanti minuti richiede la riattivazione; se il cron notturno (`/api/cron/anonimizza`, una chiamata al giorno) conta da solo come attività sufficiente a evitare la pausa (la documentazione parla di «qualche richiesta al giorno» senza dare una soglia).
- Sul piano Free i progetti attivi sono al massimo 2 fra tutte le organizzazioni di cui si è proprietari: per ripristinare su un progetto nuovo (§4) serve un posto libero.

*Da verificare:* i prezzi sono in dollari, IVA esclusa; l'importo in euro dipende dal cambio e dalla fatturazione. La documentazione mostra ancora un'immagine con «90 giorni» per la finestra di riattivazione, mentre il testo dice 1 anno: fa fede la dashboard del progetto in pausa.

## 3. Backup manuale

**Quale connessione.** `pg_dump` vuole una sessione vera con Postgres:

- la connessione diretta `db.<ref>.supabase.co:5432` è solo IPv6 (IPv4 solo con un componente a pagamento): dalla maggior parte delle reti di casa e di ufficio non si raggiunge;
- il transaction pooler sulla porta **6543** (quello di `DATABASE_URL`) non va bene: restituisce la connessione dopo ogni transazione;
- si usa il **session pooler**: stesso host del pooler di `DATABASE_URL`, porta **5432**, utente `postgres.<ref>`. È la stringa «Session pooler» in Supabase → **Connect**, ed è quella che Supabase indica per backup e ripristino dalle reti IPv4.

**Che cosa serve sul PC.** La [CLI di Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) e Docker Desktop acceso (la CLI esegue `pg_dump` in un contenitore con la versione giusta), più `psql` per il ripristino. La password è quella del database (la stessa dentro `DATABASE_URL`); se contiene caratteri speciali va codificata nell'URL.

```bash
supabase db dump --remote="postgresql://postgres.<ref>:<password>@<host-pooler>:5432/postgres" -f roles.sql --role-only
```

```bash
supabase db dump --remote="postgresql://postgres.<ref>:<password>@<host-pooler>:5432/postgres" -f schema.sql
```

```bash
supabase db dump --remote="postgresql://postgres.<ref>:<password>@<host-pooler>:5432/postgres" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

```bash
supabase db dump --remote="postgresql://postgres.<ref>:<password>@<host-pooler>:5432/postgres" -f history_schema.sql --schema supabase_migrations
```

```bash
supabase db dump --remote="postgresql://postgres.<ref>:<password>@<host-pooler>:5432/postgres" -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

Sono i comandi della guida ufficiale «Backup and Restore using the CLI». I cinque file vanno in una cartella con la data, **fuori dal repository** e in almeno due posti (per esempio il PC e un disco o un cloud cifrato): contengono nomi, telefoni, email e indirizzi dei clienti degli ordini da casa, quindi valgono le stesse cautele del database. La password resta nella cronologia del terminale: cancellarla o usare una variabile d'ambiente.

Controlli da fare subito dopo, ogni volta:

- `data.sql` non è vuoto e contiene le righe di `ordini` e `piatti` (cerca i nomi delle tabelle nel file);
- *da verificare alla prima prova:* che `data.sql` contenga anche gli utenti dello staff (`auth.users`). Se non ci sono, dopo un ripristino gli utenti si ricreano a mano (§4, passo 5).

Senza Docker si può usare `pg_dump` installato sul PC verso la stessa connessione (`pg_dump "host=<host-pooler> port=5432 dbname=postgres user=postgres.<ref> sslmode=require" --schema=public --schema=supabase_migrations -f backup.sql`). *Da verificare:* la versione di `pg_dump` deve essere uguale o successiva a quella del server, e il file così ottenuto non è stato provato in ripristino su un progetto Supabase nuovo, dove lo schema `public` esiste già.

Lo script `scripts/interroga-sql.ts` non è un backup: legge soltanto.

## 4. Ripristino su un progetto nuovo

Quando il database è perso o rovinato e non basta riattivarlo. Si perde tutto ciò che è successo dopo l'ultimo backup.

1. **Crea il progetto** su Supabase, regione **eu-central-1** (Francoforte, accanto alle funzioni Vercel `fra1`), e scegli una password del database nuova. Annota il `ref` del progetto.
2. **Carica il backup** con la stringa «Session pooler» del progetto *nuovo*:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql --dbname "postgresql://postgres.<ref-nuovo>:<password>@<host-pooler>:5432/postgres"
   ```

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 --file history_schema.sql --file history_data.sql --dbname "postgresql://postgres.<ref-nuovo>:<password>@<host-pooler>:5432/postgres"
   ```

   Il primo comando è una sola transazione: se si ferma, non resta nulla e si può correggere e rilanciare. Gli errori noti (`supabase_admin`, `cli_login_postgres`) e i rimedi sono nella sezione «Troubleshooting notes» della guida ufficiale.
3. **Controlla il contenuto** con `DATABASE_URL` del progetto nuovo in un file d'ambiente a parte (mai sovrascrivere `.env.local` prima di aver finito): `npx tsx --env-file=<file> scripts/interroga-sql.ts scripts/sql/coerenza-ordini.sql` deve dare zero righe per ogni controllo. Lo script di lettura stampa le tabelle; `scripts/applica-sql.ts <file>` senza flag mostra a quale host punta l'indirizzo, senza collegarsi.
4. **Migrazioni mancanti.** Se il backup è più vecchio dell'ultima migrazione del repository, applica quelle che mancano, in ordine, con `scripts/applica-sql.ts <file> --prova` e poi `--conferma` (vedi README, sezione «Database»). Se si parte senza backup (database vuoto) si applicano tutte con `--crea-registro` alla prima, poi il menù con `supabase/seed.sql` tramite `psql` (lo script lo rifiuta: il seed apre la sua transazione).
5. **Utenti dello staff.** Su Supabase → Authentication → Users controlla che ci siano. Se mancano, ricreali con le stesse email e riassegna i ruoli con `npm run ruolo -- <email> admin|staff`. Le impostazioni di Authentication (URL del sito, iscrizioni aperte o chiuse, email) **non** sono nel backup: vanno rimesse a mano. *Da verificare:* annotare oggi quelle del progetto attuale, perché nel repository non sono scritte.
6. **Limiti di tempo del ruolo.** Il progetto attuale ha `statement_timeout` 15 s e `lock_timeout` 5 s sul ruolo `postgres`. *Da verificare* che `roles.sql` li riporti: `select rolconfig from pg_roles where rolname = 'postgres'`. L'app li imposta comunque a ogni transazione (`src/server/db-adapter.ts`).
7. **Variabili su Vercel** (Production), poi **Redeploy**: le variabili cambiate valgono solo per i deploy nuovi.

   | Variabile | Nuovo valore |
   | --- | --- |
   | `DATABASE_URL` | Connect → **Transaction pooler** (porta 6543) del progetto nuovo, con la password nuova, senza `?sslmode` |
   | `SUPABASE_URL` | Project Settings → API del progetto nuovo |
   | `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API del progetto nuovo |

   Le altre (`APP_URL`, `RESEND_API_KEY`, `EMAIL_MITTENTE`, `CRON_SECRET`, `STAMPA_TOKEN`) non cambiano: il ponte di stampa parla con il sito, non con il database. Le stesse tre vanno aggiornate in `.env.local` e nei segreti di GitHub (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), e l'utente di prova degli e2e (`E2E_EMAIL`) va ricreato nel progetto nuovo, altrimenti la CI fallisce.
8. **Prova**: `/stato`, il menù pubblico, login dello staff, un ordine di prova al tavolo, una stampa di prova. *Da verificare:* se il login al database fallisce per il certificato, confrontare la CA del progetto nuovo (Database → Settings → SSL) con `src/server/ca-supabase.ts`.
9. **Non cancellare il progetto vecchio** finché il nuovo non ha lavorato una serata: cancellare un progetto elimina per sempre dati e backup.

## 5. Tornare al deploy precedente su Vercel

Quando il guasto è arrivato con un deploy.

1. Vercel → progetto → riquadro **Production Deployment** → **Instant Rollback** → scegli il deploy precedente → **Confirm Rollback**. È immediato: i domini tornano a puntare al deploy scelto, senza ricompilare. (Da terminale: `vercel rollback`.)
2. Sul piano Hobby si può tornare **solo al deploy immediatamente precedente**; sui piani a pagamento a qualsiasi deploy che sia stato in produzione.
3. Il deploy ripristinato usa le variabili d'ambiente con cui era stato compilato: un cambio di variabili fatto dopo non lo raggiunge. I cron tornano quelli di quel deploy.
4. **Dopo un rollback Vercel smette di mandare in produzione i nuovi push su `main`.** Finché non lo si annulla (riquadro Production Deployment → **Manage** → promuovi un deploy), le correzioni unite su `main` restano fuori. Va fatto appena la correzione è pronta.

Il rollback di Vercel non tocca il database: se nel frattempo è stata applicata una migrazione, vedi §6.

## 6. Migrazione applicata e deploy precedente incompatibile

Le migrazioni si applicano prima del deploy che le legge. Se quel deploy va ritirato, il database resta con la migrazione dentro.

- **Migrazione solo additiva** (tabella nuova, colonna facoltativa o con valore predefinito): il deploy precedente la ignora. Basta il rollback di Vercel (§5); la migrazione resta.
- **Migrazione che il codice vecchio non regge** (colonna tolta o rinominata, colonna obbligatoria senza valore predefinito, vincolo più stretto):
  1. **Meglio correggere in avanti**: sistemare il codice e fare un deploy nuovo. È quasi sempre più rapido e non tocca i dati.
  2. Se non si può, scrivere una **migrazione di ritorno** come file nuovo in `supabase/migrations/` (versione successiva), provarla sui test PGlite, poi `scripts/applica-sql.ts <file> --prova` e, con l'autorizzazione di chi decide, `--conferma`. Poi rollback di Vercel.
  3. Mai modificare un file di migrazione già applicato, mai cancellare a mano righe da `supabase_migrations.schema_migrations`, mai rieseguire il seed.
  4. Il ripristino dal backup (§4) è l'ultima scelta: serve solo se i **dati** sono rovinati, e fa perdere tutto ciò che è successo dopo il backup.
- **Per non arrivarci**: prima di una migrazione che non è solo additiva, fare un backup (§3) e dividerla in due deploy (prima il codice che funziona con entrambe le forme, poi la migrazione che toglie la vecchia).

`--prova` e `--conferma` tengono i lock della migrazione per tutta la transazione: durante il servizio una migrazione che riscrive una tabella ferma le richieste su quella tabella. Fuori dal servizio, quando si può.

## 7. Decisioni per il titolare

Scelte di costo e di rischio ancora aperte. Qui sono solo elencate.

1. **Piano Pro di Supabase (25 $/mese)**: backup giornalieri automatici con 7 giorni di storia e nessuna pausa per inattività. Senza, l'unica protezione sono i backup manuali del punto 2.
2. **Frequenza dei backup manuali** (se si resta su Free, o in aggiunta): quanto lavoro si accetta di perdere? Ogni giorno di servizio, ogni settimana, prima di ogni migrazione. E chi li fa, e dove si conservano le copie (contengono dati personali dei clienti).
3. **PITR (circa 100 $/mese oltre al Pro)**: riduce la perdita massima da un giorno a pochi minuti. Ha senso solo se un giorno di ordini perso è inaccettabile.
4. **Prova generale del ripristino**: mezza giornata di lavoro su un progetto Supabase di scarto (gratuito, se c'è un posto libero fra i 2 del piano Free) per provare §3 e §4 e chiudere i «da verificare». Senza, il primo ripristino vero sarà anche la prima prova.
5. **Piano di Vercel**: *da verificare* su quale piano è il progetto. La documentazione di Vercel riserva il piano Hobby all'uso personale e non commerciale, e su Hobby il rollback torna indietro di un solo deploy.
6. **Chiusure lunghe**: se si resta su Free, decidere chi controlla l'email di avviso di Supabase e riattiva il progetto prima della riapertura.

## Fonti

Consultate il 10/11/2026.

- Supabase, backup e PITR (piani, conservazione, prezzi del PITR): <https://supabase.com/docs/guides/platform/backups>
- Supabase, prezzi (Free senza backup automatici, pausa dopo 1 settimana, Pro 25 $/mese, backup 7 giorni): <https://supabase.com/pricing>
- Supabase, fatturazione per organizzazione e limite di 2 progetti gratuiti: <https://supabase.com/docs/guides/platform/billing-on-supabase>
- Supabase, crediti di calcolo inclusi nei piani a pagamento: <https://supabase.com/docs/guides/platform/manage-your-usage/compute>
- Supabase, pausa dei progetti gratuiti e riattivazione: <https://supabase.com/docs/guides/platform/project-pausing> e <https://supabase.com/docs/guides/platform/upgrading#time-limits>
- Supabase, checklist di produzione (i backup non si scaricano sul piano Free): <https://supabase.com/docs/guides/platform/going-into-prod>
- Supabase, backup e ripristino con la CLI (comandi di §3 e §4): <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- Supabase, tipi di connessione, IPv4/IPv6 e porte: <https://supabase.com/docs/guides/database/connecting-to-postgres>
- Supabase, «Restore to a new project» (solo piani a pagamento): <https://supabase.com/docs/guides/platform/clone-project>
- Vercel, Instant Rollback: <https://vercel.com/docs/instant-rollback> e comando `vercel rollback`: <https://vercel.com/docs/cli/rollback>
- Vercel, variabili d'ambiente (valgono solo per i deploy nuovi): <https://vercel.com/docs/environment-variables>
- Vercel, piano Hobby: <https://vercel.com/docs/plans/hobby>
