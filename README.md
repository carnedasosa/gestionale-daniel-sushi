# Gestionale ordini di Daniel's Sushi

Web app per gestire il menù e gli ordini di Daniel's Sushi (Bitetto), costruita con Next.js, TypeScript e Supabase.

Il lavoro è diviso in tappe:

- **Tappa 1**: base del progetto, menù pubblico con allergeni, accesso admin/staff e gestione del menù.
- **Tappa 2**: tavoli, QR, codice del cameriere, carrello con note e poke, cucina e conto.
- **Tappa 3**: asporto e domicilio: zone, orari, fasce, checkout, accettazione con suono, pagina dello stato ed email.
- **Tappa 4**: messa online: connessione cifrata al database, Vercel a Francoforte, prove end-to-end, poi dominio ed email.
- **Il locale**: ordini dalla cassa (telefono e WhatsApp), comanda del cameriere, reparti nel menù (banco sushi, cucina, sala), comande per reparto e postazioni dei dispositivi.

Documentazione di progetto:

- Specifica: [`docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`](docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md)
- Specifica della tappa 3: [`docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md`](docs/superpowers/specs/2026-10-12-tappa-3-domicilio-asporto-design.md)
- Specifica della tappa 4: [`docs/superpowers/specs/2026-10-13-tappa-4-messa-online-design.md`](docs/superpowers/specs/2026-10-13-tappa-4-messa-online-design.md)
- Specifica del locale (reparti, postazioni, cassa e cameriere): [`docs/superpowers/specs/2026-10-16-reparti-e-cassa-design.md`](docs/superpowers/specs/2026-10-16-reparti-e-cassa-design.md)
- Verbali delle prove: [`docs/verifiche/`](docs/verifiche/) (l'ultima serata simulata: [`2026-10-16-serata-quattro-dispositivi.md`](docs/verifiche/2026-10-16-serata-quattro-dispositivi.md))
- Piani di lavoro: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Requisiti

- Node 22

## Avvio

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Copia `.env.example` in `.env.local` e compila le variabili:

   | Variabile | Dove trovarla |
   | --- | --- |
   | `SUPABASE_URL` | Supabase → Project Settings → API |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database. Senza `?sslmode=…`: la connessione è cifrata dal gestionale, con il certificato di Supabase (`src/server/ca-supabase.ts`) verificato |
   | `APP_URL` (opzionale) | URL assoluto dell'app per i QR e per i link nelle email, es. `https://ordini.esempio.it`; se assente i QR usano l'host della richiesta e le email restano spente |
   | `RESEND_API_KEY` (opzionale) | Resend → API Keys; senza, le email ai clienti restano spente |
   | `EMAIL_MITTENTE` (opzionale) | mittente su un dominio verificato in Resend, es. `Daniel's Sushi <ordini@tuodominio.it>` |
   | `CRON_SECRET` (opzionale) | stringa casuale di almeno 16 caratteri; su Vercel protegge il cron di anonimizzazione |
   | `ORDINI_CASA_PROVA` (solo locale) | `1` per provare gli ordini da casa senza allergeni confermati; ignorata in produzione |
   | `E2E_EMAIL`, `E2E_PASSWORD` (solo locale) | utente di prova creato in Supabase → Authentication → Users, solo per `npm run e2e`; sul database reale non ha ruoli |

   Queste variabili sono lette solo dal server e non finiscono mai nel browser. Non committare `.env.local`.

3. Avvia l'app:

   ```bash
   npm run dev
   ```

   Poi apri http://localhost:3000.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm test` | esegue i test |
| `npm run typecheck` | controlla i tipi TypeScript |
| `npm run lint` | esegue ESLint |
| `npm run build` | compila l'app per la produzione |
| `npm run e2e` | prove end-to-end nel browser (tavolo, ordine da casa, ordine dalla cassa, reparti) sulla build di produzione, con un database finto |
| `npm run serata` | simulazione di una serata intera a quattro dispositivi dello staff (circa 5 minuti con la compilazione), sullo stesso database finto |

## Prove end-to-end

`npm run e2e` compila l'app, la avvia su http://127.0.0.1:3100 e la collega a un database PGlite in memoria (`e2e/db-locale.ts`) con migrazioni, seed e dati di prova: il database reale non viene mai toccato. Il login dello staff usa Supabase Auth con l'utente di prova (`E2E_EMAIL`, `E2E_PASSWORD`), che riceve il ruolo admin solo nel database finto. La prima volta serve `npx playwright install chromium`. Dopo le 23:00 la prova da casa si salta, perché le fasce non attraversano la mezzanotte. Con `E2E_DEBUG=1` il database finto stampa le interrogazioni che riceve.

`npm run serata` simula una serata con il tablet della cassa, quelli del banco sushi e della cucina, il telefono di un cameriere, 6 tavoli e 7 ordini da casa (5 dal sito, 2 presi dalla cassa), con gli imprevisti di una serata vera. Alla fine controlla sul database ordini, conti, comande per reparto e origini, e scrive tempi e problemi in `test-results/serata/risultati.json`. Va lanciata prima delle 22 di Roma.

## Pubblicazione

L'app gira su Vercel, con le funzioni a Francoforte (`regions` in `vercel.json`) accanto al database Supabase (`eu-central-1`). Le variabili di Production si impostano nel progetto Vercel: quelle segrete (`DATABASE_URL`, `CRON_SECRET`) come «Sensitive». Le Preview non ricevono `DATABASE_URL`, così nessuna anteprima scrive sul database reale; `ORDINI_CASA_PROVA` non va mai impostata su Vercel.

## Database

- Le migrazioni sono in `supabase/migrations/` e si applicano in ordine di nome. Le ultime tre, del locale, vanno applicate **in quest'ordine**, ognuna prima del deploy che la legge:
  1. `20261016120000_origine_ordini.sql` — colonna `ordini.origine` (`cliente`, `cassa`, `cameriere`) e vincoli per gli ordini della cassa;
  2. `20261017120000_reparti_menu.sql` — `categorie.reparto` e `righe_ordine.reparto`, con i reparti delle righe già esistenti;
  3. `20261018120000_comande_reparto.sql` — tabella `comande`, con le comande anche per gli ordini già esistenti.
- Il seed del menù è generato da `data/menu-sito.json` con `npm run seed`, che scrive `supabase/seed.sql`. Il seed è pensato per un database vuoto.
- **Controlli di coerenza degli ordini.** Lo stato degli ordini e i totali li tiene allineati il codice, non il database. `scripts/sql/coerenza-ordini.sql` raccoglie interrogazioni di sola lettura che cercano gli ordini incoerenti: totale diverso da righe attive + consegna, stato che non segue le comande dei reparti, comande senza righe attive o righe attive senza comanda, comande «sala» negli ordini da casa, chiavi d'invio e comande doppie. Sul DB reale si eseguono in una transazione read only con `npx tsx --env-file=.env.local scripts/interroga-sql.ts scripts/sql/coerenza-ordini.sql`. Ogni controllo stampa una tabella: **zero righe vuol dire tutto coerente**, altrimenti ogni riga è un ordine da sistemare, con i valori trovati e quelli attesi. Il test `tests/db/coerenza-ordini.test.ts` esegue lo stesso file su PGlite.

## Utenti

1. Crea l'utente in Supabase → Authentication → Users → Add user (con Auto Confirm).
2. Assegna il ruolo:

   ```bash
   npm run ruolo -- <email> admin|staff
   ```

Le nuove registrazioni sono disattivate in Supabase: solo gli utenti creati a mano possono accedere.

## Pagine

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
| `/staff/conto/[sessione]` | riepilogo per la cassa |
| `/staff/nuovo-ordine` | ordine preso a voce dalla cassa (telefono o WhatsApp) |
| `/staff/tavolo/[sessione]/ordina` | comanda del cameriere per un tavolo aperto |
| `/tavolo/[chiave]` | accesso con codice e ordini al tavolo |

## Tavoli e QR

In `/admin/tavoli` aggiungi i tavoli e imposta nome, posizione e disponibilità. Lo slug identifica il tavolo in admin; il QR usa una chiave casuale di 12 caratteri. Cambiare il nome conserva il QR. «Nuovo QR», con conferma, cambia la chiave e invalida i QR precedenti. Prima di disattivare un tavolo, chiudilo dallo schermo staff.

In `/admin/tavoli/stampa` stampa in A4: quattro QR per pagina. Per i QR destinati alla sala imposta `APP_URL` con l'indirizzo raggiungibile dai telefoni, evitando un URL `localhost`. La variabile resta solo server. Il QR contiene l'indirizzo del tavolo; il codice viene comunicato dal cameriere.

Applica prima la nuova migrazione `20261012120000_tavoli_e_ordini.sql` dopo quella della tappa 1. Applica poi `20261012180000_correzioni_tavolo.sql`, che aggiunge chiavi QR, tentativi per sessione/IP e chiavi di invio uniche. Non eseguire nuovamente il seed su un database già popolato. Prima dell'applicazione al database reale va autorizzata la modifica: aggiunge cinque tabelle, indici e vincoli, con RLS attiva e privilegi API revocati; non cambia le tabelle del menù e dei ruoli.

## Schermo staff

Apri `/staff` e tocca **Inizia turno**: il browser sblocca il suono e richiede di mantenere acceso lo schermo, quando il dispositivo lo supporta. Il turno si conserva nella scheda; dopo un ricaricamento può essere necessario toccare **Riattiva suono**. Se il browser nega audio o schermo sempre acceso compare un avviso; le comande restano visibili.

Apri un tavolo e comunica il codice di quattro cifre al cliente. Non ci sono codici uguali fra tavoli aperti; alla riapertura il codice cambia. In cucina gli ordini passano da **Inviato** a **In preparazione**, poi **Servito**. Puoi annullare un ordine prima che sia servito, oppure una singola riga. Il conto esclude gli annullati e raggruppa le voci con lo stesso prezzo e le stesse scelte poke.

Il conto è stampabile dal browser ed è solo un riepilogo da battere in cassa, **non uno scontrino fiscale**. Chiudendo il tavolo i clienti non possono più inviare ordini. Se restano comande in cucina o sono arrivate dopo il conto viene chiesta una conferma esplicita. La chiusura apre il conto; la cucina conserva le comande con «Tavolo chiuso» e «Conti recenti» conserva i link per sei ore. Dal conto puoi annullare una voce anche servita.

### Comanda del cameriere

Il cliente ordina dal QR; il cameriere è la riserva per il tavolo che non vuole farlo da solo. Dal dettaglio di un tavolo aperto (scheda **Tavoli**) il cameriere, loggato sul proprio telefono (postazione **Sala**), tocca **Ordina per il tavolo** (`/staff/tavolo/[sessione]/ordina`): stesso menù e stesso carrello dei clienti, ma senza codice né cookie del tavolo, perché conta il login dello staff. La comanda nasce con origine `cameriere`, si divide nei reparti come le altre, compare con il chip «Dal cameriere» sugli schermi dello staff e in «Ordinato finora» sui telefoni del tavolo e finisce nello stesso conto. Il carrello del cameriere è separato per tavolo (`sessionStorage`), e come per i clienti ritentare lo stesso invio non crea doppioni. Se il tavolo viene chiuso nel frattempo l'invio è rifiutato e la pagina rimanda alla piantina. Non serve nessuna migrazione oltre a quella dell'origine (`20261016120000_origine_ordini.sql`).

### Postazioni

Ogni dispositivo dello staff ha una **postazione**, scelta all'inizio del turno («Questo dispositivo è») o in seguito da **Postazione…** nella barra, e ricordata in un cookie (`ds_postazione`, solo sotto `/staff`, un anno). L'indirizzo `/staff?postazione=banco` la impone per quella pagina senza salvarla: «Inizia turno» la salva.

| Postazione | Schede | Colonne | Suono |
|---|---|---|---|
| Cassa | Ordini, Tavoli, Conti, Menù, **Nuovo ordine**, ordini online | tutti gli ordini come prima, con un chip per reparto e la striscia «Da portare al tavolo» | ogni 10 s finché c'è un ordine da casa da accettare; tre bip per ogni voce nuova da portare |
| Banco sushi / Cucina | Ordini, Menù | Da preparare · In preparazione · Pronte, solo le comande del proprio reparto | tre bip per ogni comanda nuova |
| Sala (telefoni dei camerieri) | Ordini, Tavoli, Conti | come la cassa, senza interruttore online e senza «Nuovo ordine» | tre bip per ogni voce nuova da portare |

Banco e cucina non vedono gli ordini da accettare, i tavoli né i conti: il server carica solo le comande del loro reparto. Gli ordini da casa compaiono al banco e in cucina solo dopo che la cassa li ha accettati. Senza cookie e senza `?postazione=` il dispositivo è la cassa.

### Reparti e comande

Ogni categoria del menù ha un **reparto**, cioè chi la prepara: **Banco sushi** (tartare, sashimi, sushi-gio, hosomaki, nigiri, triangolini, uramaki, special roll, poke bowl, box), **Cucina** (starter, primi, dessert) e **Sala** (beverage: le bevande le prende la sala, non la cucina). Il reparto si cambia in `/admin/menu`, nell'intestazione di ogni categoria, e vale per gli ordini da quel momento: ogni riga d'ordine copia il reparto alla creazione (`righe_ordine.reparto`), così cambiare categoria non sposta le comande già in corso. La poke composta va al reparto della categoria `poke-bowl`. Il seed parte con questa divisione (`REPARTO_SEED` in `src/domain/reparti.ts`); la migrazione `20261017120000_reparti_menu.sql` aggiunge le colonne e assegna il reparto anche alle righe già esistenti. Sugli schermi della cassa e della sala le righe di un ordine che tocca più reparti si dividono sotto «Banco sushi», «Cucina», «Sala», e la card ha un chip per reparto con il suo stato (es. «Cucina: In preparazione», «Sala: da portare»), con i colori di stato già esistenti.

Ogni ordine ha una **comanda per reparto** presente nelle righe (tabella `comande`): banco, cucina, sala (= bevande). Il reparto avanza solo la propria («Inizia a preparare», «Segna pronta») e lo stato dell'ordine si ricava dalle comande nella stessa transazione:

| Comande attive | Tavolo | Casa (dopo l'accettazione) |
|---|---|---|
| tutte da preparare | Inviato | Accettato |
| qualcuna avanzata, non tutte pronte | In preparazione | In preparazione |
| tutte pronte | Servito | Pronto |

Accettazione, rifiuto, partenza, consegna/ritiro e annullamenti restano alla cassa. Le bevande non passano da un reparto: per i tavoli compaiono nella striscia **Da portare al tavolo** di cassa e sala e diventano pronte col bottone **Portate**; negli ordini da casa non hanno comanda (le mette nel sacchetto la cassa, e un ordine di sole bibite si porta avanti coi bottoni della cassa). Nella stessa striscia compaiono le comande di banco e cucina già pronte, finché la sala non tocca **Portate** (o il tavolo si chiude). Annullando righe o voci del conto, la comanda rimasta senza righe si annulla e lo stato dell'ordine si ricalcola. I bottoni della cassa sulle card intere («Inizia a preparare», «Segna servito», «Segna pronto») restano come **emergenza**: portano avanti tutte le comande dell'ordine insieme. Il lock è sempre sull'ordine prima delle comande (sessione → ordine → comande).

La migrazione `20261018120000_comande_reparto.sql` crea le comande anche per gli ordini esistenti: va applicata al database reale prima del deploy che la usa.

## Ordini al tavolo

Il cliente scansiona il QR, inserisce il codice, sceglie i piatti e invia il carrello alla cucina. Ogni riga può avere una nota di massimo 200 caratteri e una quantità da 1 a 20; massimo 40 righe per ordine. I prezzi sono indicativi sul telefono e vengono sempre ricalcolati sul server dal menù e dalle regole poke. Un piatto diventato esaurito fa rifiutare l'intero ordine senza salvare comande parziali.

La poke composta si abilita quando l'admin ha impostato prezzo base ed extra. Gli ingredienti restano quelli importati dal menù; minimi, massimi e quantità incluse si modificano in `/admin/poke`. Chiedi al personale gli allergeni ancora in verifica.

Il carrello e la sua chiave di invio si conservano in `sessionStorage` per quella sessione del tavolo. Ritentare lo stesso carrello non crea un ordine doppio; cambiare quantità, note o righe genera una nuova chiave. Le poke diventate non valide vanno ricomposte prima dell’invio. Più telefoni vedono gli stessi ordini e il totale in **Ordinato finora**. L'accesso usa cookie `httpOnly`, `sameSite=lax`, sicuri in produzione: sessione di 12 ore e dispositivo di un anno. Cinque errori dallo stesso dispositivo, oppure venti dalla stessa rete (sul Wi-Fi del locale tutti i telefoni hanno lo stesso indirizzo), nella sessione aperta e negli ultimi dieci minuti, bloccano ulteriori tentativi. Trenta errori per sessione bloccano ogni nuovo accesso, anche da dispositivi o reti mai visti, finché il personale non preme «Sblocca». Lo staff può sbloccare la sessione; riaprire il tavolo azzera il conteggio.

Lo schermo staff si aggiorna ogni 5 secondi e il tavolo ogni 10. L'aggiornamento si ferma nelle schede nascoste e riparte subito quando tornano visibili o torna la connessione. Prima del refresh viene controllata la connessione con `GET /stato`, senza DB: se manca, la schermata resta visibile con l’ora dell’ultimo aggiornamento e riprende automaticamente. Il browser non legge mai il database: viene usato `router.refresh()`, senza Supabase Realtime o policy di lettura API. `cacheComponents` resta disabilitato. I test SQL usano PGlite con tutte le migrazioni reali e transazioni, senza Docker. PGlite serializza le transazioni e non prova la concorrenza reale: in Postgres le garanzie dipendono dagli indici unici e dai lock.

## Ordini da casa

Applica la migrazione `20261013120000_domicilio_asporto.sql` dopo le precedenti: aggiunge zone, orari, chiusure, impostazioni e coda delle email, e le colonne degli ordini da casa. Gli ordini dei tavoli restano validi. Anche questa va autorizzata prima di applicarla al database reale.

In `/admin/domicilio` imposta il telefono del locale, gli ordini per fascia di 15 minuti e quanti di questi possono essere a domicilio, l'anticipo minimo, le zone (costo e ordine minimo), i turni di asporto e domicilio per ogni giorno e le chiusure straordinarie. Le zone non si cancellano: si disattivano.

Gli ordini si aprono solo dallo schermo staff con **Apri ordini di oggi**: l'interruttore vale per il giorno in cui si accende e il giorno dopo riparte spento. Servono anche il telefono del locale, gli allergeni confermati e almeno una fascia libera. Il cliente sceglie i piatti in `/`, conferma in `/ordina` (asporto o domicilio, fascia, dati, contanti o carta, privacy) e segue l'ordine in `/ordine/<token>`. Il server ricalcola tutto: se il totale cambia, l'ordine non parte e il riepilogo si aggiorna. Due clienti non possono prendere insieme l'ultimo posto di una fascia: gli invii da casa si mettono in fila sul lock delle impostazioni. Al massimo 3 ordini in attesa per telefono e 10 all'ora per rete.

Sullo schermo staff gli ordini da casa compaiono in **Da accettare** con un suono ogni 10 secondi: **Accetta**, **Accetta +15’**, **Accetta +30’** o **Rifiuta** con motivo. Poi passano nella cucina insieme ai tavoli: **Da preparare**, **In preparazione**, **Pronti e in consegna** (Pronto → Ritirato, oppure Partito → Consegnato).

### Ordini dalla cassa

Applica la migrazione `20261016120000_origine_ordini.sql`: aggiunge la colonna `origine` (`cliente`, `cassa`, `cameriere`) agli ordini e allenta i vincoli per quelli della cassa. Va autorizzata prima di applicarla al database reale.

Gli ordini presi al telefono o su WhatsApp si inseriscono da **Nuovo ordine** nella barra dello schermo staff (`/staff/nuovo-ordine`): stesso menù del sito, poi **Dati del cliente** con asporto o domicilio, orario, nome e telefono, pagamento; l'email è facoltativa e non si chiede il consenso privacy (l'ordine è dettato a voce). L'ordine nasce già **accettato**, va in cucina con il chip «Dalla cassa» e **occupa l'orario** come quelli del sito; per questi ordini non partono email e non valgono i limiti per telefono e per rete. Gli ordini dalla cassa valgono anche con **Apri ordini di oggi** spento (l'interruttore governa solo il sito): la cassa può ordinare anche con gli ordini online chiusi o con allergeni da confermare (l'obbligo vale per la vendita a distanza), ma non in un giorno di chiusura e solo nei turni impostati. Sotto ogni orario c'è l'occupazione (es. `3/4`); gli orari pieni o troppo vicini sono barrati e si sbloccano con **Forza**: il sito vedrà quell'orario pieno.

Le email (ricevuto, accettato, rifiutato, annullato) si accodano nel database e partono subito dopo l'azione; quelle non riuscite si ritentano a ogni aggiornamento dello schermo staff, fino a 5 volte. Servono `RESEND_API_KEY`, `EMAIL_MITTENTE` con un dominio verificato e `APP_URL`; senza, le email restano in coda e l'app funziona lo stesso. Ogni giorno alle 3 il cron di Vercel (`vercel.json`) chiama `/api/cron/anonimizza`, che toglie i dati personali dagli ordini da casa più vecchi di 12 mesi.

## Allergeni

Per la vendita a distanza il Reg. UE 1169/2011, art. 14, impone che le informazioni sugli allergeni siano disponibili prima dell'acquisto. Per questo gli ordini da casa non partono finché tutti i piatti disponibili non hanno gli allergeni confermati, e la poke composta si ordina da casa solo quando in `/admin/poke` sono confermati gli allergeni di tutti gli ingredienti. Per le prove in locale c'è `ORDINI_CASA_PROVA=1`, ignorata in produzione.
