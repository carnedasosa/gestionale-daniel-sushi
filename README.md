# Gestionale ordini di Daniel's Sushi

Web app per gestire il menù e gli ordini di Daniel's Sushi (Bitetto), costruita con Next.js, TypeScript e Supabase.

Il lavoro è diviso in tappe:

- **Tappa 1**: base del progetto, menù pubblico con allergeni, accesso admin/staff e gestione del menù.
- **Tappa 2**: tavoli, QR, codice del cameriere, carrello con note e poke, cucina e conto.
- **Tappa 3**: asporto e domicilio, ancora da implementare.

Documentazione di progetto:

- Specifica: [`docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`](docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md)
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
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database |
   | `APP_URL` (opzionale) | URL assoluto dell'app per i QR, es. `https://ordini.esempio.it`; se assente viene usato l'host della richiesta |

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

## Database

- Le migrazioni sono in `supabase/migrations/`.
- Il seed del menù è generato da `data/menu-sito.json` con `npm run seed`, che scrive `supabase/seed.sql`. Il seed è pensato per un database vuoto.

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
| `/` | menù pubblico |
| `/accesso` | accesso per admin e staff |
| `/admin/menu` | gestione del menù (admin) |
| `/admin/poke` | prezzi e regole della poke (admin) |
| `/admin/tavoli` | gestione tavoli (admin) |
| `/admin/tavoli/stampa` | QR dei tavoli attivi (admin) |
| `/staff` | cucina e apertura/chiusura tavoli |
| `/staff/conto/[sessione]` | riepilogo per la cassa |
| `/tavolo/[chiave]` | accesso con codice e ordini al tavolo |

## Tavoli e QR

In `/admin/tavoli` aggiungi i tavoli e imposta nome, posizione e disponibilità. Lo slug identifica il tavolo in admin; il QR usa una chiave casuale di 12 caratteri. Cambiare il nome conserva il QR. «Nuovo QR», con conferma, cambia la chiave e invalida i QR precedenti. Prima di disattivare un tavolo, chiudilo dallo schermo staff.

In `/admin/tavoli/stampa` stampa in A4: quattro QR per pagina. Per i QR destinati alla sala imposta `APP_URL` con l'indirizzo raggiungibile dai telefoni, evitando un URL `localhost`. La variabile resta solo server. Il QR contiene l'indirizzo del tavolo; il codice viene comunicato dal cameriere.

Applica prima la nuova migrazione `20261012120000_tavoli_e_ordini.sql` dopo quella della tappa 1. Applica poi `20261012180000_correzioni_tavolo.sql`, che aggiunge chiavi QR, tentativi per sessione/IP e chiavi di invio uniche. Non eseguire nuovamente il seed su un database già popolato. Prima dell'applicazione al database reale va autorizzata la modifica: aggiunge cinque tabelle, indici e vincoli, con RLS attiva e privilegi API revocati; non cambia le tabelle del menù e dei ruoli.

## Schermo staff

Apri `/staff` e tocca **Inizia turno**: il browser sblocca il suono e richiede di mantenere acceso lo schermo, quando il dispositivo lo supporta. Il turno si conserva nella scheda; dopo un ricaricamento può essere necessario toccare **Riattiva suono**. Se il browser nega audio o schermo sempre acceso compare un avviso; le comande restano visibili.

Apri un tavolo e comunica il codice di quattro cifre al cliente. Non ci sono codici uguali fra tavoli aperti; alla riapertura il codice cambia. In cucina gli ordini passano da **Inviato** a **In preparazione**, poi **Servito**. Puoi annullare un ordine prima che sia servito, oppure una singola riga. Il conto esclude gli annullati e raggruppa le voci con lo stesso prezzo e le stesse scelte poke.

Il conto è stampabile dal browser ed è solo un riepilogo da battere in cassa, **non uno scontrino fiscale**. Chiudendo il tavolo i clienti non possono più inviare ordini. Se restano comande in cucina o sono arrivate dopo il conto viene chiesta una conferma esplicita. La chiusura apre il conto; la cucina conserva le comande con «Tavolo chiuso» e «Conti recenti» conserva i link per sei ore. Dal conto puoi annullare una voce anche servita.

## Ordini al tavolo

Il cliente scansiona il QR, inserisce il codice, sceglie i piatti e invia il carrello alla cucina. Ogni riga può avere una nota di massimo 200 caratteri e una quantità da 1 a 20; massimo 40 righe per ordine. I prezzi sono indicativi sul telefono e vengono sempre ricalcolati sul server dal menù e dalle regole poke. Un piatto diventato esaurito fa rifiutare l'intero ordine senza salvare comande parziali.

La poke composta si abilita quando l'admin ha impostato prezzo base ed extra. Gli ingredienti restano quelli importati dal menù; minimi, massimi e quantità incluse si modificano in `/admin/poke`. Chiedi al personale gli allergeni ancora in verifica.

Il carrello e la sua chiave di invio si conservano in `sessionStorage` per quella sessione del tavolo. Ritentare lo stesso carrello non crea un ordine doppio; cambiare quantità, note o righe genera una nuova chiave. Le poke diventate non valide vanno ricomposte prima dell’invio. Più telefoni vedono gli stessi ordini e il totale in **Ordinato finora**. L'accesso usa cookie `httpOnly`, `sameSite=lax`, sicuri in produzione: sessione di 12 ore e dispositivo di un anno. Cinque errori per dispositivo oppure per IP, nella sessione aperta e negli ultimi dieci minuti, bloccano ulteriori tentativi. Trenta errori per sessione bloccano solo dispositivi/IP che hanno già sbagliato. Lo staff può sbloccare la sessione; riaprire il tavolo azzera il conteggio.

Lo schermo staff si aggiorna ogni 5 secondi e il tavolo ogni 10. L'aggiornamento si ferma nelle schede nascoste e riparte subito quando tornano visibili o torna la connessione. Prima del refresh viene controllata la connessione con `GET /stato`, senza DB: se manca, la schermata resta visibile con l’ora dell’ultimo aggiornamento e riprende automaticamente. Il browser non legge mai il database: viene usato `router.refresh()`, senza Supabase Realtime o policy di lettura API. `cacheComponents` resta disabilitato. I test SQL usano PGlite con tutte le migrazioni reali e transazioni, senza Docker. PGlite serializza le transazioni e non prova la concorrenza reale: in Postgres le garanzie dipendono dagli indici unici e dai lock.

## Allergeni

Per la vendita a distanza il Reg. UE 1169/2011, art. 14, impone che le informazioni sugli allergeni siano disponibili prima dell'acquisto. Per questo gli ordini da casa non partono finché tutti i piatti non hanno gli allergeni confermati.
