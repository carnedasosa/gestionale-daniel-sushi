# Il locale: reparti, postazioni, cassa e cameriere — design

Data: 2026-10-16 · Stato: realizzato (PR #15, #16, #17, #18 e la PR di chiusura con la serata a quattro dispositivi) · Spec generale: [`2026-10-11-gestionale-ordini-design.md`](2026-10-11-gestionale-ordini-design.md)

## 1. Obiettivo

Portare il gestionale dentro il locale com'è davvero. Fino alla tappa 4 c'era **uno schermo staff unico** per tutti, le comande **non sapevano di che reparto erano**, lo stato avanzava **per ordine intero** e lo staff **non poteva creare ordini**: gli ordini al telefono restavano fuori dal sistema (e non occupavano le fasce), banco e cucina avrebbero visto le stesse card con tutti i bottoni.

**Successo:** in una serata ogni ordine (QR, sito, telefono, WhatsApp, cameriere) entra nel gestionale; il banco sushi e la cucina vedono e portano avanti solo la propria parte; la cassa accetta, consegna e porta al tavolo; lo stato dell'ordine e il conto restano coerenti. Lo prova `npm run serata` (verbale: [`docs/verifiche/2026-10-16-serata-quattro-dispositivi.md`](../../verifiche/2026-10-16-serata-quattro-dispositivi.md)).

## 2. Il locale

| Chi | Dove | Dispositivo | Che cosa fa nel gestionale |
|---|---|---|---|
| Una ragazza alla cassa | all'ingresso | tablet, postazione **Cassa** | apre e chiude i tavoli, accetta o rifiuta gli ordini da casa, prende quelli al telefono e su WhatsApp, segna partito/consegnato/ritirato, porta al tavolo bevande e piatti pronti, apre gli ordini online, segna gli esauriti |
| Due sushi chef | bancone a vista | tablet, postazione **Banco sushi** | solo le comande del banco: «Inizia a preparare», «Segna pronta»; esauriti |
| La cucina | non a vista | tablet, postazione **Cucina** | solo le comande della cucina, come il banco |
| Due camerieri | in sala | il proprio telefono, postazione **Sala** | tavoli, conti, «Da portare al tavolo», comanda per i tavoli che non ordinano dal QR |

Il cliente al tavolo ordina dal proprio telefono (QR + codice); il cliente da casa dal sito.

## 3. Decisioni di prodotto (con l'utente, 16/10)

1. **Tavoli: il QR prima, il cameriere di riserva.** Il cliente ordina dal QR; il cameriere, loggato come staff sul suo telefono, può inserire l'ordine per un tavolo che non vuole farlo da solo (`/staff/tavolo/[sessione]/ordina`), senza codice. La comanda è segnata «Dal cameriere» ovunque (schermi staff e «Ordinato finora» dei clienti) e finisce nello stesso conto.
2. **Reparti: banco, cucina, sala.** Ogni categoria del menù ha un reparto, modificabile in `/admin/menu`:
   - `banco` = tartare, sashimi, sushi-gio, hosomaki, nigiri, triangolini, uramaki, special-roll, poke-bowl, box (la poke composta segue `poke-bowl`);
   - `cucina` = starter, primi, dessert;
   - `sala` = beverage.

   **Chi vede cosa:** banco e cucina vedono solo le proprie comande, e degli ordini da casa solo quelli già accettati; non vedono «Da accettare», tavoli né conti. Ogni reparto segna pronta la propria parte. Cassa e sala vedono gli ordini interi, con un chip per reparto, e la striscia «Da portare al tavolo». La sala porta al tavolo **tutti** i piatti, non solo le bevande: il reparto dice solo chi *prepara*.
3. **Ordini dalla cassa.** La cassa inserisce gli ordini presi al telefono o su WhatsApp da `/staff/nuovo-ordine` (nessuna integrazione WhatsApp):
   - nascono **già accettati** e vanno subito al banco e in cucina;
   - bastano nome e telefono: email facoltativa, **nessuna email** al cliente, **nessun consenso privacy** (l'ordine è dettato a voce), nessun limite per telefono e per rete;
   - **occupano la fascia** come quelli del sito; un orario pieno o troppo vicino si può **forzare** con una spunta esplicita, e il sito lo vedrà pieno;
   - valgono **anche con «Apri ordini di oggi» spento** (l'interruttore governa solo il sito) e con allergeni da confermare (il Reg. UE 1169/2011 riguarda la vendita a distanza); non nei giorni di chiusura né fuori dai turni impostati.
4. **Bevande alla cassa e alla sala.** Le bevande non vanno in cucina: per i tavoli compaiono nella striscia «Da portare al tavolo» di cassa e sala e si chiudono con «Portate». Negli ordini da casa le mette nel sacchetto la cassa, quindi non hanno una comanda.

Le due scelte minori del punto 3 (ordini con il sito spento, fascia forzabile) sono state decise nel piano, su delega dell'utente, e restano da confermare con Daniel nella prova in sala.

## 4. Scelte tecniche

### 4.1 Origine dell'ordine (`20261016120000_origine_ordini.sql`)

`ordini.origine text not null default 'cliente' check (origine in ('cliente','cassa','cameriere'))`. I vincoli dicono quale origine vale per quale tipo: tavolo `cliente|cameriere`, casa `cliente|cassa`; un ordine della cassa non può essere `in_attesa`; `privacy_il` e `cliente_email` sono obbligatori solo per `cliente`. La coda delle email inserisce solo per `origine='cliente'`, anche negli annullamenti successivi. Una colonna invece di dedurre l'origine dai dati: si legge in un colpo sugli schermi e nei controlli, e i vincoli la difendono nel database.

### 4.2 Reparto nelle righe (`20261017120000_reparti_menu.sql`)

`categorie.reparto` (default `banco`) e `righe_ordine.reparto`, copiato dalla categoria del piatto quando l'ordine nasce (`prezzaRighe` fa join su `categorie`). Copiarlo invece di leggerlo al volo significa che cambiare il reparto di una categoria vale **per gli ordini da adesso** e non sposta le comande in corso. La migrazione assegna il reparto alle righe già esistenti (righe senza piatto → reparto di `poke-bowl`, altrimenti `banco`), poi `not null`, check e indice `(ordine_id, reparto)`.

### 4.3 Comande per reparto con stato derivato (`20261018120000_comande_reparto.sql`)

Tabella `comande(ordine_id, reparto, stato, creata_il, iniziata_il, pronta_il, portata_il, unique(ordine_id, reparto))`: **una comanda per reparto presente nelle righe** (da casa senza `sala`). Stati: `da_preparare → in_preparazione → pronta`, oppure `annullata`; le bevande passano in un tocco («Portate»).

Scartati: lo stato per riga (N aggiornamenti per tocco, si mescola con `annullata` e con il conto) e colonne `stato_banco/stato_cucina` sugli ordini (una migrazione per ogni reparto nuovo).

`ordini.stato` resta lo **stato macro**, ricavato dalle comande nella stessa transazione (`aggiornaStatoOrdine`, `statoOrdineDaComande`), così conto, chiusura del tavolo, pagina dell'ordine, email, registro annullamenti e occupazione delle fasce non sono cambiati:

| Comande attive | Tavolo | Casa (dopo l'accettazione) |
|---|---|---|
| tutte da preparare | `inviato` | `accettato` |
| qualcuna avanzata, non tutte pronte | `in_preparazione` | `in_preparazione` |
| tutte pronte | `servito` | `pronto` |

Accettazione, rifiuto, partenza, consegna/ritiro e annullamenti restano passaggi della cassa.

**Cascata per la cassa.** I bottoni della cassa sulla card intera («Inizia a preparare», «Segna servito», «Segna pronto») restano come emergenza e portano dietro tutte le comande (`cascataComande`); rifiuto e annullamento le annullano. Annullare righe o voci del conto annulla la comanda rimasta senza righe (`segnaComandeAnnullate`) e ricalcola lo stato. `portata_il` tiene il «Portate» dei piatti pronti di banco e cucina, che restano nella striscia finché la sala non li porta o il tavolo si chiude.

### 4.4 Postazione nel cookie

`ds_postazione` (`cassa|banco|cucina|sala`), `path=/staff`, `httpOnly`, `sameSite=lax`, un anno, scritto da `impostaPostazione` dopo `richiediRuolo('staff')`. Un cookie e non `localStorage` perché serve **al server**: per banco e cucina `page.tsx` carica solo `comandeAttive(reparto)` e rende le colonne giuste al primo disegno. `?postazione=` vince sul cookie senza scriverlo (prove, serata, cambi al volo); «Inizia turno» lo salva. Senza nessuno dei due il dispositivo è la cassa. Schede e suoni per postazione stanno in `src/domain/postazioni.ts`.

### 4.5 Ordine dei lock: sessione → ordine → comande

Chiunque tocchi le comande blocca **prima l'ordine** (`select … for update` su `ordini`), poi le comande; chi parte dal tavolo blocca prima la sessione. È lo stesso ordine di `annullaRiga` e della chiusura del tavolo, quindi la cassa (cascata, annullamenti, chiusura) e i reparti non si incrociano in un deadlock, e il passo di un reparto su un ordine appena annullato non passa (`avanzaComanda` riceve lo stato visto dallo schermo e rifiuta se è cambiato). L'`unique (ordine_id, reparto)` impedisce comande doppie. PGlite serializza le transazioni e non prova la concorrenza: le garanzie stanno negli indici e nei lock di Postgres.

## 5. Prove

- Test SQL su PGlite con tutte le migrazioni (`tests/db/origine-ordini.test.ts`, `reparti-menu.test.ts`, `comande.test.ts` con `primaDi` sullo schema precedente), repository (`comande-repo.test.ts`, `ordini-casa-repo.test.ts`, `ordini-repo.test.ts`), dominio, azioni (ruolo prima dei dati) e render.
- E2E: `cassa-ordine.spec.ts` (asporto dalla cassa fino al ritiro), `tavolo.spec.ts` (comanda del cameriere a 375 px), `reparti.spec.ts` (banco e cucina sullo stesso ordine misto).
- Serata a quattro dispositivi (`npm run serata`): controlli finali su comande per reparto, origini ed email.
- Da fare: prova in sala con Daniel (elenco nel verbale della serata).
