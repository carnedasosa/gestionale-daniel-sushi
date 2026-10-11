# Gestionale ordini di Daniel's Sushi — design

Data: 2026-10-11 · Stato: in revisione

## 1. Obiettivo

Daniel's Sushi (Via Beato Giacomo 72, Bitetto) ha approvato il sito statico in `C:\Users\aless\Desktop\daniel-sushi` e chiede due cose:

1. **Ordini da casa senza telefonate né messaggi**: asporto e consegna a domicilio col fattorino del locale.
2. **Ordini dal tavolo**: il cliente ordina dal telefono, niente comande a mano, il cameriere si dedica al servizio.

**Successo** = il telefono squilla molto meno per gli ordini, la cucina riceve ordini leggibili e completi, il personale di sala non scrive più comande, Daniel gestisce menù e regole da solo.

## 2. Decisioni prese (2026-10-11)

| Tema | Decisione |
|---|---|
| Ordini da casa | Asporto **e** domicilio con fattorino proprio |
| Pagamento | **Solo alla consegna o al ritiro** (contanti/POS). Nessun pagamento online nella v1. Al tavolo si paga in cassa come oggi. Lo scontrino fiscale resta al registratore del locale |
| Dove arrivano gli ordini | **Schermo web** (tablet) in cucina e al banco, in tempo reale. Niente stampante |
| Accesso al tavolo | Il personale **apre il tavolo**, il sistema genera un **codice di 4 cifre** che il cameriere comunica; il cliente lo inserisce dopo aver scansionato il QR. Alla chiusura il codice scade |
| Orario asporto/domicilio | **Fasce di 15 minuti** con **limite di ordini per fascia**, modificabile da Daniel |
| Conferma ordini da casa | **Accettazione manuale** dal tablet (Accetta / Rifiuta con motivo), con suono |
| Avvisi al cliente | **Pagina dello stato in tempo reale** + **email** (conferma, rifiuto, riepilogo) |
| Zone di consegna | **Elenco di zone/comuni**, ognuna con costo di consegna e ordine minimo |
| Personalizzazione | **Nota libera su ogni piatto** + **composer «Componi la tua poke»** con regole modificabili |
| Accessi | **Staff** (accesso condiviso del tablet) e **Admin** (Daniel) |
| Architettura | **App separata** accanto al sito statico; i bottoni «Ordina ora» del sito puntano all'app |

Più telefoni allo stesso tavolo usano lo stesso codice: ognuno invia i suoi ordini, che si sommano nel conto del tavolo.

## 3. Architettura

- **Next.js (App Router, TypeScript)** pubblicata su **Vercel**.
- **Supabase**: Postgres, Auth (solo staff e admin), Realtime (schermo cucina e pagina stato).
- **Resend** per le email transazionali.
- UI del cliente sul design system «Carta e indaco» del sito (`daniel-sushi/design-system/`: `tokens.css`, `components/bundle.css`, `motion.md`), copiato nell'app con le stesse regole: indaco per la struttura, caldi solo in blob/onde/bordi, un solo bottone pieno per schermata. Le aree staff e admin usano gli stessi token ma privilegiano leggibilità e pulsanti grandi.
- Le versioni esatte delle librerie si fissano nel piano d'implementazione, verificandole al momento.

**Principi:**
- I clienti non hanno account e non accedono mai direttamente al database: ogni lettura e scrittura passa dal server dell'app. RLS di Supabase chiusa per gli utenti anonimi.
- Il server **ricalcola sempre prezzi, extra, costo di consegna e totali** dal database; il carrello del telefono è solo una proposta.
- Ogni riga d'ordine salva **una copia** di nome, numero e prezzo del piatto: cambiare il menù non altera gli ordini passati.
- Logica di dominio (prezzi, fasce, stati, codici) in moduli puri, separati da UI e database, così si testano da soli.

## 4. Aree dell'app

### 4.1 Cliente da casa — `/`
1. **Menù** per categorie, come sul sito (numero, nome, descrizione, prezzo, badge, **allergeni**). I piatti non disponibili sono visibili ma non ordinabili.
2. **Carrello**: quantità, nota per piatto, poke composte.
3. **Checkout**: asporto o domicilio · nome · telefono · email · (domicilio) zona + indirizzo + citofono/note · fascia oraria tra quelle libere · riepilogo con totale e metodo di pagamento («alla consegna»/«al ritiro») · consenso privacy.
4. **Pagina dello stato** `/ordine/[token]` (token lungo e casuale): stato in tempo reale, riepilogo, orario. Il link arriva anche per email.

Se gli ordini online sono chiusi (fuori orario, interruttore spento, nessuna fascia libera oggi) il menù resta consultabile e il checkout spiega perché non si può ordinare.

### 4.2 Cliente al tavolo — `/tavolo/[tavolo]`
1. Scansiona il QR del tavolo → inserisce il **codice di 4 cifre**. Codice giusto → il telefono resta collegato a quella sessione del tavolo finché è aperta.
2. Stesso menù (con allergeni), carrello con note e poke.
3. **Invia ordine** → va diretto in cucina (nessuna accettazione: il codice è già il controllo).
4. **«Ordinato finora»**: tutto ciò che il tavolo ha inviato, da tutti i telefoni, con lo stato e il totale progressivo.
5. Tavolo chiuso → il telefono mostra «Tavolo chiuso, grazie!» e non può più ordinare.

Tentativi di codice limitati (es. 5 errori → attesa di qualche minuto) per impedire di indovinarlo.

### 4.3 Staff — `/staff` (tablet)
All'avvio: tocco su **«Inizia turno»** (sblocca l'audio del browser e tiene acceso lo schermo).
- **Da accettare**: ordini da casa in attesa, con suono ripetuto finché non vengono gestiti. Accetta / Rifiuta (motivi rapidi: zona non servita, fascia piena, chiusi, altro).
- **In cucina**: tutti gli ordini accettati e quelli dei tavoli, in colonne per stato, ordinati per fascia/arrivo. Le note e le poke sono evidenziate.
- **Tavoli**: mappa/elenco dei tavoli; Apri (mostra il codice in grande) · Chiudi (mostra il riepilogo del conto da battere in cassa) · annullare una riga inviata per errore.
- Stato in tempo reale; se la connessione cade compare un avviso ben visibile e alla riconnessione i dati si riallineano.

### 4.4 Admin — `/admin` (Daniel)
- **Menù**: categorie, piatti, prezzi, descrizioni, badge, **allergeni**, disponibilità (anche al volo: «finito il tonno»), ordine.
- **Poke**: gruppi, ingredienti, minimo/massimo per gruppo, prezzo base, prezzo degli ingredienti extra.
- **Domicilio**: zone (nome, costo, minimo, attiva), fasce (durata 15', capacità, anticipo minimo), orari settimanali e chiusure straordinarie, interruttore ordini online.
- **Tavoli**: elenco tavoli e **stampa dei QR**.
- **Storico ordini** con filtri per giorno e tipo, e totali del giorno.
- **Accessi**: password dello staff.

Il primo menù si importa da `daniel-sushi/data/menu.json` (categorie, voci, flag, composer della poke).

## 5. Regole di dominio

**Stati degli ordini da casa:**
`in_attesa` → `accettato` | `rifiutato` → `in_preparazione` → `pronto` → (`in_consegna` solo domicilio) → `completato`. Da qualunque stato prima di `completato` lo staff può `annullare`.
- Se un ordine resta `in_attesa` più di **10 minuti**, la pagina del cliente lo dice e mostra il numero del locale; sul tablet l'ordine diventa più evidente. Non si rifiuta da solo.
- Email al cliente: ricevuto, accettato (con orario), rifiutato (con motivo), annullato.

**Stati degli ordini al tavolo:** `inviato` → `in_preparazione` → `servito`; singole righe annullabili dallo staff.

**Fasce:**
- Generate dagli orari del giorno, a passi di 15 minuti; ordini solo **per il giorno stesso** nella v1.
- Una fascia è prenotabile se inizia almeno «anticipo minimo» dopo adesso (default 30') e se gli ordini già presenti in quella fascia (`in_attesa` e accettati, non rifiutati/annullati) sono sotto la capacità.
- La capacità è controllata in modo atomico al momento dell'invio: due clienti non possono prendere l'ultimo posto insieme.

**Prezzi:**
- Totale = somma righe + (domicilio) costo della zona.
- Domicilio sotto l'ordine minimo della zona → non si può confermare (il messaggio dice quanto manca).
- Poke composta = prezzo base + extra per gli ingredienti oltre quelli inclusi; minimi e massimi per gruppo rispettati lato server.

**Codice del tavolo:** 4 cifre casuali, generato all'apertura, valido solo per quella sessione; mai due tavoli aperti con lo stesso codice.

## 6. Obblighi e dati personali

- **Allergeni**: per la vendita a distanza il Reg. (UE) 1169/2011, art. 14, richiede che le informazioni sugli allergeni siano disponibili **prima dell'acquisto** e alla consegna (sanzioni D.Lgs. 231/2017). Ogni piatto ha quindi l'elenco dei 14 allergeni, visibile nel menù dell'app. **Gli ordini da casa non vanno aperti al pubblico finché Daniel non ha compilato gli allergeni.**
- **Privacy**: si raccolgono solo i dati che servono all'ordine (nome, telefono, email, indirizzo). Informativa privacy e consenso al checkout; il testo dell'informativa va fornito/validato dal locale. I dati personali degli ordini vengono anonimizzati dopo 12 mesi, restano i totali per le statistiche.
- **Fiscale**: l'app non emette scontrini né documenti fiscali; il riepilogo del tavolo e quello degli ordini sono solo di supporto alla cassa.

## 7. Tappe

1. **Base** — progetto, database, import del menù, login staff/admin, admin menù (con allergeni e disponibilità), menù pubblico con allergeni. *Daniel può iniziare subito a compilare gli allergeni.*
2. **Tavolo** — schermo staff con stati in tempo reale, tavoli e QR, apertura/chiusura con codice, ordine dal tavolo (con note e composer della poke), «ordinato finora», riepilogo conto. *Si può provare in sala appena finita.*
3. **Domicilio e asporto** — zone, orari, fasce, checkout, accettazione con suono, pagina dello stato, email, collegamento dei bottoni «Ordina ora» del sito.

Ogni tappa ha il suo piano d'implementazione e si chiude con una prova completa del flusso.

## 8. Test

- **Unità**: prezzi e poke, fasce e capacità, transizioni di stato, codice del tavolo.
- **Integrazione**: azioni del server contro un database Supabase locale (prezzi falsificati dal client rifiutati, fascia piena, tavolo chiuso, codice sbagliato).
- **End-to-end** (Playwright): ordine dal tavolo da due telefoni + chiusura del conto; ordine a domicilio dall'invio all'accettazione con aggiornamento della pagina dello stato.

## 9. Dati da chiedere a Daniel

Non bloccano lo sviluppo (si usano valori provvisori), ma vanno raccolti prima di andare live:

- Allergeni di ogni piatto (**bloccante per gli ordini da casa**)
- Orari di apertura e numero di telefono
- Zone di consegna, costo e ordine minimo per zona
- Capacità per fascia e anticipo minimo
- Regole e prezzo della poke composta (quanti ingredienti per gruppo, extra)
- Numero e nomi dei tavoli
- Email mittente/dominio per le email, testo dell'informativa privacy
- Dominio su cui pubblicare l'app

## 10. Fuori dalla v1

Pagamento online · SMS/WhatsApp · stampante di comande · ordini per i giorni successivi · account cliente e storico personale · «chiama il cameriere»/«chiedi il conto» dal tavolo · statistiche avanzate · migrazione del sito statico nell'app (il sito potrà leggere il menù dall'app in seguito, per avere una sola fonte).
