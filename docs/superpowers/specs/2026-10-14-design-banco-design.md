# Design «Banco» — rifacimento dell'interfaccia — design

Data: 2026-10-14 · Stato: in revisione · Spec generale: [`2026-10-11-gestionale-ordini-design.md`](2026-10-11-gestionale-ordini-design.md) (§4 schermate)
Canvas approvato: https://claude.ai/artifact/F4KGcxrn5dCEQmf6ZGigfL (20 tavole, privato)

## 1. Obiettivo

La logica del gestionale funziona, ma le schermate si capiscono poco. Rifacciamo l'interfaccia di **tutta l'app** con uno stile nuovo, «Banco», che non prende nulla dal design system del sito di Daniel's Sushi né dall'imitazione di iOS di oggi («Cupertino»).

**Successo:**
- Chi usa una schermata per la prima volta capisce subito **cosa sta guardando** (lo stato, scritto e colorato) e **cosa deve fare** (un solo bottone principale per zona, con un verbo).
- Lo staff trova ordini, tavoli e conti senza scorrere una pagina lunga: tre schede.
- Daniel usa l'admin da telefono e da computer, e sa sempre in che sezione si trova.
- Nessun cambio alle regole del locale: stessi stati, stessi controlli, stessi dati. I 292 test di partenza restano verdi (aggiornati solo dove cambia il testo dei bottoni o il markup).

## 2. Decisioni prese con l'utente (2026-10-14)

| Tema | Decisione |
|---|---|
| Perimetro | **Tutta l'app**: clienti da casa, clienti al tavolo, staff, admin, accesso, pagine di servizio |
| Dispositivo admin | **Ovunque**: barra laterale su computer, barra in basso su telefono |
| Stile | **A · Banco**: carta calda, inchiostro, un colore per ogni stato, numeri da scontrino |
| Canvas | Approvato così com'è («procedi») |
| Aggiunte piccole | Approvate tutte e cinque (§6): orari pieni barrati, cronologia dell'ordine, riassunto sul tavolo, ricerca e filtro «Esauriti» nel menù admin, lista «Si possono aprire gli ordini da casa?» |

Scelte tecniche (di Claude, su delega dell'utente):
- CSS puro come oggi (niente Tailwind né librerie di componenti): token su `:root`, classi con prefisso `b-`.
- Caratteri **Archivo** (testi e titoli) e **JetBrains Mono** (numeri) con `next/font/google`, che li ospita dal nostro dominio: nessuna richiesta a Google dal browser dei clienti. Verificato su `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` (Next 16.4.0) e sull'opzione `variable` di `03-api-reference/02-components/font.md`.
- Le schede dello staff sono un parametro dell'indirizzo (`/staff?vista=ordini|tavoli|conti`): cambiare scheda non smonta suono e memoria degli ordini già visti, e il link a una scheda funziona.
- Cronologia dell'ordine senza toccare il database: si mostrano l'ora d'arrivo (`creato_il`) e l'ora dello stato attuale (`aggiornato_il`); i passaggi intermedi sono spuntati senza ora.
- Si passa a Banco **un'area alla volta**: i fogli Cupertino restano finché l'ultima area non è migrata, poi si cancellano.

## 3. Stato di partenza (verificato il 2026-10-14)

- `main` = `4f36f42` (tappe 1–4 fase A). Branch di questo lavoro: `claude/daniel-sushi-ui-redesign-1a54b1`.
- 64 file di test, **292 test verdi** (`npx vitest run`).
- Stili: `src/styles/ds/cupertino.css` (126 righe), `tokens.css` (alias «Carta e indaco» su Cupertino), `bundle.css` (classi `ds-*`), `src/styles/menu.css`, più un CSS per area (`staff.css`, `admin.css`, `tavolo.css`, `casa.css`, `accesso.css`, `globals.css`).
- Test che leggono testi o classi dell'interfaccia: `src/app/staff/SchermoStaff.test.tsx`, `src/app/staff/page.test.tsx`, `src/app/staff/ChiusuraConto.test.tsx`, `src/app/(cliente)/componenti.test.tsx`, `src/app/tavolo/[chiave]/componenti.test.tsx`, `src/menu/componenti/MenuCliente.test.tsx`, `e2e/tavolo.spec.ts`, `e2e/casa.spec.ts`.
- Database: `ordini` ha `creato_il` e `aggiornato_il` (aggiornato a ogni cambio di stato da `ordini-casa-repo.ts`); nessuna ora per singolo stato.

## 4. Le fondamenta di Banco

### 4.1 Token (`src/styles/banco/token.css`)

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--b-carta` | `#F3EFE6` | `#141310` | fondo delle pagine |
| `--b-foglio` | `#FFFFFF` | `#1E1D19` | card, liste, pannelli |
| `--b-campo` | `#FBF9F4` | `#25231E` | fondo dei campi |
| `--b-inchiostro` | `#1C1B18` | `#F1ECE1` | testo, bottone principale |
| `--b-su-inchiostro` | `#F3EFE6` | `#141310` | testo sul bottone principale |
| `--b-grafite` | `#5E5A52` | `#A8A296` | testo secondario |
| `--b-filetto` | `#DCD6C8` | `#3A372F` | bordi e separatori |
| `--b-bordo-campo` | `#CFC8B8` | `#4A463D` | bordo dei campi |

Stati (sfondo / testo / punto). In scuro gli sfondi scendono di luminosità e i testi salgono:

| Stato | Chiaro | Scuro | Significato |
|---|---|---|---|
| `accettare` | `#FCE3D3` / `#8A2C05` / `#D9520C` | `#3D2210` / `#FFB98C` / `#F07A33` | serve una decisione |
| `preparare` | `#E9E4D8` / `#1C1B18` / `#1C1B18` | `#2E2B25` / `#F1ECE1` / `#F1ECE1` | in coda |
| `preparazione` | `#DCE8FB` / `#123F86` / `#2B63C9` | `#14264A` / `#A9C6F5` / `#5B8BE0` | ci si sta lavorando |
| `pronto` | `#D9F0DF` / `#12572A` / `#1F8A44` | `#123020` / `#9EDDB0` / `#3FB766` | fatto, servito, ritirato |
| `ritardo` | `#FBDCDA` / `#8E1B14` / `#C8261B` | `#3E1512` / `#F5A9A3` / `#E5534A` | attesa lunga, errore, annullato |

Il colore aiuta, ma **lo stato è sempre scritto a parole**. Il piano include uno script che controlla il contrasto (≥ 4,5:1 per i testi) di tutte le coppie testo/sfondo, in chiaro e in scuro.

Scuro: `@media (prefers-color-scheme: dark)`. La barra dello staff resta scura in entrambi i modi. Stampa (conto, QR): sempre chiaro.

Misure: spazi 4/8/12/16/20/24/32/48; raggi 10 (campi), 12 (bottoni), 16–18 (card), 24 (pannelli); target ≥ 48 px, bottoni principali dello staff 56 px, «Inizia turno» 72 px.

### 4.2 Caratteri

`src/app/layout.tsx` carica Archivo (400–800) e JetBrains Mono (500, 700) con `next/font/google`, `subsets: ['latin']`, `variable: '--b-font-testo'` e `'--b-font-numeri'`. La classe `.b-num` usa il mono con `font-variant-numeric: tabular-nums` per prezzi, codici, orari, timer e numeri d'ordine.

### 4.3 Pezzi riutilizzabili (`src/styles/banco/componenti.css` + `src/componenti/`)

- **Bottoni** `b-btn`: `--principale` (pieno inchiostro, uno per zona), `--secondario` (contorno), `--pericolo` (contorno rosso; l'azione chiede sempre conferma), `--discreto` (solo testo sottolineato). `aria-busy` mostra la rotella come oggi.
- **Etichetta di stato** `b-stato b-stato--<tono>`: componente `EtichettaStato` + funzione pura `tonoStato(stato)` in `src/domain/toni-stato.ts` (tavolo e casa).
- **Card** `b-card`, **lista** `b-lista` (righe separate da trattino), **scontrino** `b-scontrino` (righe prezzo con separatore tratteggiato e totale).
- **Campo** `b-campo`: etichetta sopra, errore sotto in rosso con bordo rosso; `aria-invalid` e `aria-describedby` come oggi.
- **Scelta a riquadro** `b-scelta` (radio/checkbox grandi: asporto/domicilio, pagamento, ingredienti, allergeni).
- **Schede** `b-schede` (segmentate), **interruttore** `b-interruttore` (`role="switch"`), **avviso** `b-avviso--<tono>`.
- **Pannello** (`Pannello.tsx`, sempre `<dialog>`): su telefono sale dal basso, su schermi larghi è centrato. `ConfermaAzione` lo riusa come oggi.
- **Altre azioni** (`src/componenti/AltreAzioni.tsx`): un bottone discreto che apre un pannello con le azioni rare o pericolose di una card.

Movimento: solo dissolvenze e pressione (scala 0,98) sotto i 200 ms, spente con `prefers-reduced-motion`.

## 5. Le schermate

Le rotte non cambiano. Il riferimento visivo di ogni schermata è la tavola omonima del canvas.

### 5.1 Clienti da casa (`/`, `/ordina`, `/ordine/[token]`, `/privacy`)

- **Menù** (`Casa-Menu`): testata con logo e indirizzo; striscia dell'ordine in corso (stato + «Segui →») al posto del link testuale; riquadro «Ordini aperti stasera» con gli orari di inizio; categorie a pillole che scorrono; piatti in lista con numero, nome, descrizione, etichette, allergeni e prezzo; «+» rotondo che diventa «− n +». Piatto esaurito: barrato con «Esaurito stasera». La poke ha un riquadro «Componi la tua poke →». Barra fissa in basso «n · Vedi il carrello · totale». A ordini chiusi si mostra il motivo (`TESTO_MOTIVO`) e il menù resta consultabile, senza bottoni.
- **Componi la poke** (`Casa-Poke`): un gruppo per passo (Base → Proteine → Condimenti → Salse → Topping), barra dei 5 passi, riepilogo dei passi fatti con «Cambia», riquadri grandi per gli ingredienti, contatore «2 di 3 scelte», allergeni della poke aggiornati mentre si sceglie (o il rimando al personale se non confermati), prezzo stimato e «Avanti: <prossimo gruppo>» / «Aggiungi al carrello» all'ultimo passo. Il passo non avanza se il gruppo non rispetta minimo e massimo: lo dice la nuova funzione pura `controllaGruppo(gruppo, scelte)` in `src/domain/poke.ts`; l'aggiunta finale resta su `validaPoke`.
- **Carrello** (pannello, `Casa-Carrello`): righe con quantità «− n +», «Nota per la cucina» che si apre a richiesta, «Rimuovi»; totale stimato; «Vai al riepilogo →» (da casa) o «Manda in cucina» (al tavolo).
- **Riepilogo e conferma** (`Casa-Checkout`): cinque blocchi numerati (Come lo ricevi? · Dove lo portiamo? · A che ora, circa? · Chi sei? · Come paghi?), scelte a riquadro, orari come bottoni con quelli pieni barrati (§6.1), scontrino dell'ordine con «Modifica il carrello», privacy, barra fissa «Conferma l'ordine · totale». Errori accanto al campo, come oggi.
- **Stato dell'ordine** (`Casa-Stato`): numero, stato grande, orario di consegna/ritiro e indirizzo; cronologia dei passaggi (§6.2); «La pagina si aggiorna da sola»; scontrino; «Chiama il locale». Dopo 10 minuti senza risposta resta l'avviso con il telefono. Rifiutato/annullato: niente cronologia, solo stato e motivo.
- **Privacy**: solo nuova tipografia.

### 5.2 Clienti al tavolo (`/tavolo/[chiave]`)

- **Entra al tavolo** (`Tavolo-Codice`): «Benvenuti al Tavolo 4», 4 caselle per le cifre (un solo `<input>` vero, `inputmode="numeric"`, le caselle sono solo la sua resa grafica), «Entra al tavolo», nota sul codice condiviso. Saluto «tavolo chiuso» come oggi.
- **Menù** (`Tavolo-Menu`): testata con nome del tavolo e due schede, **Menù** e **Ordinato (n)**, come ancore della stessa pagina (niente nuove rotte). Lista piatti identica a quella di casa; barra fissa «Rivedi e manda in cucina · totale».
- **Ordinato finora** (`Tavolo-Ordinato`): card per ordine con stato colorato, ora e righe (annullate barrate con «Annullato»), barra scura in basso con «Totale del tavolo finora».

### 5.3 Staff sul tablet (`/staff`, `/staff/conto/[sessione]`)

Barra scura fissa: «Staff», schede **Ordini** (badge arancione = ordini da accettare + ordini nuovi non letti), **Tavoli**, **Conti**; a destra lo stato degli ordini online (tocco = pannello con apri/chiudi e motivi di asporto e domicilio, il `PannelloOrdiniOnline` di oggi), il suono (attivo / «Riattiva suono») e l'ora. «Esci» va in fondo al pannello degli ordini online.

- **Inizio turno** (`Staff-Inizio`): «Buon turno», le due cose che servono (suono, schermo acceso), «Inizia turno».
- **Ordini** (`Staff-Ordini`): quattro colonne, **Da accettare · Da preparare · In preparazione · Pronti e in consegna**, con titolo, punto colorato e conteggio. Card «comanda»: in alto tipo e orario (o nome del tavolo), timer in minuti, numero e totale; righe con quantità in grassetto mono, note in evidenza, poke con gli ingredienti; **un bottone principale** con l'azione: «Accetta», «Inizia a preparare», «Segna pronto», «Segna partito», «Segna servito», «Segna ritirato», «Segna consegnato». Sotto, per gli ordini da casa da accettare: «Accetta +15′», «Accetta +30′», «Rifiuta…». Per gli altri: «Altre azioni» con «Segna come letto», «Annulla un piatto…», «Annulla tutto l'ordine…» (con conferma). Ordine nuovo: bordo arancione + etichetta «Nuovo»; da accettare da più di 10 minuti: bordo e timer rossi, «In attesa da più di 10 minuti». Ordinamento, suono e memoria «letto» invariati. Sotto i 900 px di larghezza le colonne diventano due, sotto i 600 una.
- **Tavoli** (`Staff-Tavoli`): legenda; griglia di riquadri: aperto (codice grande, «dalle 20:05 · 3 ordini», riassunto §6.3), libero (tratteggiato con «Apri tavolo»), da sbloccare (bordo rosso, «5 codici sbagliati»). Il tocco su un tavolo aperto apre il dettaglio a lato (pannello sotto i 900 px): codice gigante, ordini, in cucina, totale, «Apri il conto», «Sblocca» se servono, «Chiudi tavolo…».
- **Conti** (`Staff-Conti`): a sinistra tavoli aperti (con totale) e chiusi nelle ultime 6 ore; il tocco apre `/staff/conto/[sessione]` nella stessa cornice: voci con «Annulla» per voce, avviso «È arrivato 1 nuovo ordine…» con «Ho ricontrollato», voce nuova segnata, totale grande, «Da battere in cassa · non è uno scontrino fiscale», «Stampa», «Chiudi tavolo» (con le conferme di oggi). Sulla pagina del conto la barra mostra solo le schede e l'ora; come oggi, lì il tablet non suona per i nuovi ordini.

### 5.4 Admin (`/admin/*`)

Cornice nuova in `src/app/admin/layout.tsx`: barra laterale (computer) o barra in basso con 5 voci (telefono, sotto gli 800 px): **Menù** (badge con i piatti ad allergeni da confermare), **Poke**, **Tavoli e QR**, **Domicilio e asporto**, **Altro** (solo telefono: schermo staff, menù dei clienti, esci). La voce attiva è evidenziata (`aria-current="page"`, componente client con `usePathname`). I link esterni sono separati dalle sezioni.

- **Menù** (`Admin-Menu`, `Admin-Menu-Telefono`): titolo con conteggio, ricerca (§6.4), avviso allergeni con «Mostra solo questi», schede **Tutti · Allergeni da confermare · Esauriti**, tabelle per categoria (N., piatto, prezzo, etichetta allergeni, interruttore **Disponibile/Esaurito**, «Modifica»). Su telefono: righe compatte con interruttore.
- **Modifica piatto** (`Admin-Piatto`): «← Menù · categoria», numero e nome con stato degli allergeni; blocco «Come appare nel menù» (nome, descrizione, prezzo, etichette a pillola) e blocco «Allergeni» (14 riquadri + conferma evidenziata che anticipa cosa leggerà il cliente); barra fissa «Annulla / Salva il piatto».
- **Tavoli e QR** (`Admin-Tavoli`): «Stampa i QR», «Aggiungi tavolo» (apre un pannello); card per tavolo con anteprima del QR, stato, link, nome, ordine, «Salva», «Nuovo QR…» con conferma che spiega le conseguenze; tavolo disattivato tratteggiato con «Riattiva il tavolo». Stampa QR: solo tipografia.
- **Poke** (`Admin-Poke`): schede **Prezzi e regole · Allergeni degli ingredienti**; prezzi; tabella dei gruppi (minimo, massimo, inclusi) con spiegazione di «Inclusi»; elenco degli ingredienti con allergeni o «Da compilare».
- **Domicilio e asporto** (`Admin-Domicilio`): lista «Si possono aprire gli ordini da casa?» (§6.5); orari della settimana in tabella (turni come pillole con ×, «Aggiungi turno» in pannello); zone di consegna; «Quanti ordini reggiamo» (capacità, anticipo, telefono); chiusure straordinarie.

### 5.5 Accesso e pagine di servizio

- **Accesso** (`Accesso`): fondo inchiostro, «Gestionale», modulo chiaro con email, password, errore e «Entra».
- `not-found`, `error.tsx` di staff/admin/tavolo, avvisi di connessione (`AggiornamentoAutomatico`) e «Database non raggiungibile»: stessi testi, componenti `b-avviso`.

## 6. Le cinque aggiunte

Tutte di sola lettura o di sola interfaccia: nessuna migrazione, nessuna regola nuova.

### 6.1 Orari pieni barrati (checkout)

- Nuova funzione pura `fascePiene(servizio, fasce, occupazione, regole, adesso)` in `src/domain/fasce.ts`: le fasce **dopo** l'anticipo minimo che `fasciaPrenotabile` scarta per capacità (totale o tetto consegne).
- `DisponibilitaServizio` aggiunge `piene: string[]` (vuoto se il servizio è chiuso); `ServizioCheckout` lo riceve dalla pagina `/ordina`.
- Il checkout mostra libere e piene in ordine di orario; le piene sono bottoni disabilitati, barrati, con «pieno» per i lettori di schermo. L'invio continua a controllare la fascia sul server come oggi.

### 6.2 Cronologia dell'ordine (stato dell'ordine)

- `OrdineCasa` e `OrdineCasaClient` aggiungono `aggiornatoIl` (colonna `o.aggiornato_il` nella select di `ordini-casa-repo.ts`, ISO in `perClient`).
- Nuova funzione pura `passiOrdine(tipo, stato)` in `src/domain/stati-casa.ts`: elenco di passi con `fatto | attuale | da_fare`.
  - Domicilio: Ordine ricevuto → Confermato dal locale → In preparazione → Pronto, sta per partire → In consegna → Consegnato.
  - Asporto: Ordine ricevuto → Confermato dal locale → In preparazione → Pronto per il ritiro → Ritirato.
  - `rifiutato` e `annullato`: nessun passo (la pagina mostra solo stato e motivo).
- Ora accanto a «Ordine ricevuto» (`creatoIl`) e al passo attuale (`aggiornatoIl`); i passi fatti in mezzo hanno solo la spunta.

### 6.3 Riassunto sul tavolo (staff, scheda Tavoli)

- Nuova funzione pura `riassuntoTavolo(ordini, sessioneId)` (in `src/domain/stati-tavolo.ts`) sugli ordini attivi già letti dallo schermo: `{ inCucina }` = ordini della sessione in `inviato` o `in_preparazione`.
- Etichetta: «n in cucina» (blu) se > 0; «Tutto servito» (verde) se il tavolo ha ordini e nessuno in cucina; niente se non ha ordini.

### 6.4 Ricerca e filtro «Esauriti» (admin, menù)

- `/admin/menu?filtro=esauriti` mostra solo i piatti non disponibili, come oggi `filtro=allergeni`.
- La ricerca è un componente client (`ElencoPiatti`) che filtra per nome o numero mentre si scrive, senza ricaricare; le categorie senza risultati spariscono; «Nessun piatto trovato» se non resta nulla. L'interruttore usa l'azione `cambiaDisponibilita` di oggi.

### 6.5 «Si possono aprire gli ordini da casa?» (admin, domicilio)

- Nuova funzione pura `requisitiCasa({ telefono, allergeniCompleti, pokeConfermati, zoneAttive })` in `src/domain/apertura-casa.ts`: quattro voci (telefono del locale; allergeni del menù; allergeni della poke, solo se la poke è ordinabile; almeno una zona attiva), ognuna `ok` o da fare con il link alla sezione giusta.
- Sostituisce i tre avvisi separati di oggi. Gli stessi controlli continuano a decidere l'apertura in `aperturaServizio`: la lista li **mostra**, non li sostituisce.

## 7. Cosa non cambia

- Rotte, azioni del server, repository (salvo `aggiornatoIl`, §6.2), database e migrazioni, autenticazione, cron, email.
- Regole: stati e passaggi, annullamenti, conferme, limiti dei tentativi, fasce e capacità, allergeni obbligatori.
- Comportamenti dello staff: aggiornamento ogni 5 s, suono, schermo acceso, memoria degli ordini letti, schermo che resta montato se il DB non risponde.
- Testi di legge e di sicurezza (allergeni, privacy, «non è uno scontrino fiscale», conferme di annullamento e di nuovo QR).

## 8. Errori e casi limite

- Caricamento e DB irraggiungibile: stessi messaggi, come `b-avviso--accettare` sotto la barra.
- Connessione assente: l'avviso di `AggiornamentoAutomatico` diventa una striscia `b-avviso` in cima.
- Pannelli: `<dialog>` modale con «Chiudi» da 48 px ed Esc; il pannello dal basso non copre la barra di sistema del telefono (`env(safe-area-inset-bottom)`).
- Barre fisse in basso (carrello, conferma, salva): lasciano spazio al contenuto (`padding-bottom` pari alla loro altezza) e rispettano la safe area.
- Testi lunghi (nomi di piatti, indirizzi): vanno a capo (`overflow-wrap: anywhere`), mai tagliati.
- Contrasto alto (`prefers-contrast: more`): bordi dei campi e dei riquadri più spessi.
- Stampa del conto e dei QR: sempre in chiaro, senza barre e bottoni.

## 9. Test

- **Unità (vitest)**: nuove funzioni pure con test propri: `tonoStato`, `controllaGruppo`, `fascePiene`, `passiOrdine`, `riassuntoTavolo`, `requisitiCasa`. Test di rendering aggiornati ai nuovi testi e classi, **mantenendo ogni verifica di comportamento** (note, poke, righe barrate, minuti, ordinamento, avviso dopo 10 minuti, bottoni della casa, motivi di chiusura, conferma bloccata, saluto del tavolo chiuso). Nuovi test di rendering: schede dello staff (`vista`), badge, dettaglio tavolo, ricerca del menù admin, cronologia, orari pieni.
- **E2E (Playwright)**: `e2e/tavolo.spec.ts` ed `e2e/casa.spec.ts` aggiornati ai nuovi nomi dei bottoni («Vedi il carrello», «Inizia a preparare», «Segna servito», poke a passi…), stesso percorso dal QR al conto e dall'ordine da casa al ritiro.
- **Contrasto**: script del piano che calcola il rapporto di tutte le coppie dei token (§4.1), chiaro e scuro.
- **Controllo visivo**: con il DB locale (PGlite) nel browser, ogni schermata a 390 px, 1180×820 e 1280 px, in chiaro e in scuro, confrontata con la tavola del canvas.
- Fine lavoro: `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run e2e`, `npm run build` verdi.

## 10. Ordine di lavoro (per il piano)

1. **Fondamenta**: token, caratteri, base, componenti CSS, `EtichettaStato`, `AltreAzioni`, `Pannello` aggiornato, script del contrasto. Cupertino resta caricato.
2. **Clienti da casa** (menù, poke a passi, carrello, checkout con §6.1, stato con §6.2).
3. **Clienti al tavolo** (codice, menù con schede, ordinato).
4. **Staff** (barra e schede, ordini, tavoli con §6.3, conti).
5. **Admin** (cornice, menù con §6.4, piatto, tavoli, poke, domicilio con §6.5) e **accesso**.
6. **Pagine di servizio e pulizia**: errori, not-found, privacy, stampa; cancellazione di `cupertino.css`, `tokens.css`, `bundle.css`, `menu.css` e delle classi `ds-*`; e2e, build e controllo visivo finale.

Ogni passo lascia l'app funzionante e tutti i test verdi.

## 11. Fuori da questa tappa

- Funzioni nuove oltre alle cinque del §6 (per esempio statistiche, stampa automatica delle comande, ricerca nel menù dei clienti).
- Un'ora salvata per ogni stato dell'ordine (servirebbe una migrazione).
- Un tema scuro forzato per lo staff indipendente dal dispositivo.
- La fase B della tappa 4 (dominio, email, QR definitivi): resta come pianificata.
