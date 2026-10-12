# Tappa 3 — Domicilio e asporto — design

Data: 2026-10-12 · Stato: in revisione · Spec generale: [`2026-10-11-gestionale-ordini-design.md`](2026-10-11-gestionale-ordini-design.md) (§4.1, §4.3, §4.4, §5, §6, §7.3)

## 1. Obiettivo

Il cliente ordina da casa (asporto o domicilio col fattorino del locale) senza telefonare. Lo staff accetta dal tablet. Il cliente segue l'ordine su una pagina che si aggiorna da sola e riceve le email. I bottoni «Ordina ora» del sito portano all'app.

**Successo:** un ordine da casa va dall'invio all'accettazione e al «Consegnato»/«Ritirato» senza telefonate. Due clienti non possono prendere insieme l'ultimo posto di una fascia. Il cliente vede sempre il prezzo vero prima di confermare. Gli ordini non arrivano mai quando nessuno è al tablet.

## 2. Decisioni prese con l'utente (2026-10-12)

| Tema | Decisione |
|---|---|
| Quando si può ordinare | Solo **a turno avviato**: l'interruttore «Ordini online» acceso sul tablet (vale solo per il giorno in cui si accende) **e** almeno una fascia prenotabile negli orari di oggi |
| Capacità per fascia | **Due numeri**: ordini totali per fascia e, di questi, massimo N a domicilio (un domicilio conta su entrambi) |
| Accettazione | **Accetta**, **Accetta +15'**, **Accetta +30'**, **Rifiuta** con motivo. Lo spostamento è una scelta dello staff: non controlla la capacità della nuova fascia |
| Pagamento | Il cliente sceglie **contanti** (facoltativo «pago con … €») o **carta (POS)**, per domicilio e asporto |
| Orari | **Separati** per asporto e domicilio, per giorno della settimana, con più turni al giorno |
| Email | Sviluppate per intero ma **spente** finché non ci sono dominio verificato e chiave Resend. La pagina dello stato funziona comunque |
| Poke composta da casa | **Allergeni per ingrediente** in `/admin/poke`. Da casa la poke composta si ordina solo quando gli allergeni di tutti gli ingredienti sono confermati. Al tavolo resta come oggi |

Restano valide le decisioni della spec generale: pagamento solo alla consegna o al ritiro, accettazione manuale con suono, zone con costo e minimo, fasce di 15', ordini solo per oggi, niente account cliente.

## 3. Stato di partenza (verificato il 2026-10-12)

- `main` = `9013b1c` (tappe 1 e 2, 192 test). Branch di questa tappa: `tappa-3-casa`.
- DB reale: 3 migrazioni applicate (`menu_e_ruoli`, `tavoli_e_ordini`, `correzioni_tavolo`). 139 piatti, **0 con allergeni confermati**, 3 ordini di prova da tavolo, nessuna sessione aperta, prezzi della poke non impostati.
- Conseguenza: sul DB reale gli ordini da casa resteranno chiusi finché Daniel non conferma gli allergeni. È il comportamento voluto (§6 della spec generale).
- Aggiornamento automatico delle pagine con polling e `router.refresh()`, senza Supabase Realtime. Si mantiene.

## 4. Esperienza

### 4.1 Cliente

1. **Menù `/`**, ordinabile: stesse card della tappa 2, carrello con note e poke composta. Il carrello si salva in `localStorage`, con la sua chiave di invio, e sopravvive alla chiusura della pagina.
   - Se nessuno dei due servizi è aperto, il menù resta consultabile senza bottoni «Aggiungi», con un avviso del motivo.
   - Se c'è un ordine recente salvato nel browser, compare il link «Hai un ordine in corso».
2. **Checkout `/ordina`**, una sola pagina. Ogni servizio chiuso si mostra disabilitato con il suo motivo.
   - Asporto o domicilio.
   - Domicilio: zona dall'elenco delle zone attive, con costo e minimo; indirizzo; citofono/note per il fattorino.
   - Fascia tra quelle prenotabili di oggi per il servizio scelto.
   - Nome, telefono, email.
   - Pagamento: contanti (con «pago con … €» facoltativo) o carta.
   - Consenso all'informativa privacy (link a `/privacy`) e riepilogo: righe, consegna, totale, «paghi alla consegna/al ritiro».
   - Sotto il minimo della zona il riepilogo dice quanto manca e l'invio è disabilitato.
3. **Invio**: il server ricalcola tutto. Se il totale differisce da quello mostrato al cliente, l'ordine non parte, compare «I prezzi sono cambiati: controlla il riepilogo» e il riepilogo si aggiorna. Se la fascia si è riempita, la pagina lo dice e propone le fasce rimaste. Se l'invio va a buon fine, il carrello si svuota e si passa alla pagina dello stato.
4. **Pagina dello stato `/ordine/[token]`**, aggiornata ogni 10 s: stato, orario (anche spostato), servizio, zona e indirizzo, riepilogo, totale, pagamento, motivo dell'eventuale rifiuto.
   - Se resta in attesa più di 10': «Non abbiamo ancora risposto: chiamaci al …» con il telefono del locale.
   - Ordine anonimizzato: «Ordine non più disponibile».
   - Stati mostrati al cliente: In attesa di conferma · Confermato · In preparazione · Pronto per il ritiro / Pronto, sta per partire · In consegna · Ritirato / Consegnato · Rifiutato · Annullato.
5. **Email** (quando attive): ricevuto, accettato (con orario), rifiutato (con motivo), annullato. Contengono il link alla pagina dello stato e il telefono del locale.

### 4.2 Staff `/staff`

- **Ordini online**, in cima. Stato attuale e bottone «Apri ordini di oggi» / «Chiudi ordini online».
  - Se aperti, ma bloccati da un'altra condizione (allergeni, telefono mancante, giorno di chiusura, nessuna fascia), mostra il motivo.
- **Da accettare**: card con servizio, orario richiesto, zona, righe e note, totale, pagamento, cliente e telefono.
  - Il suono si ripete ogni 10 s finché c'è almeno un ordine in attesa e l'audio del turno è attivo.
  - Oltre i 10' la card è evidenziata.
  - Bottoni: **Accetta**, **Accetta +15'**, **Accetta +30'**, **Rifiuta**.
  - Rifiuta apre i motivi rapidi «Zona non servita», «Fascia piena», «Stiamo chiudendo», «Altro» (con testo libero fino a 200 caratteri).
- **Cucina**: tre colonne con tavoli e casa insieme.
  - «Da preparare» = `inviato` (tavolo) + `accettato` (casa); «In preparazione»; «Pronti / in consegna» (solo casa).
  - Ordinamento per orario della fascia per la casa, per arrivo per il tavolo, in un'unica sequenza.
  - Le card da casa mostrano «Asporto 20:15» / «Domicilio 20:15 · zona», cliente, telefono, indirizzo, pagamento.
  - Bottoni: In preparazione → Pronto → «Ritirato» (asporto) oppure «Partito» → «Consegnato» (domicilio).
  - «Annulla ordine» con conferma, possibile fino a `in_consegna` compreso. Accoda l'email di annullamento.
  - L'annullamento di una singola riga resta disponibile anche per gli ordini da casa: il totale si ricalcola, consegna compresa.
- Il resto dello schermo (tavoli, conti recenti) non cambia.

### 4.3 Admin

- **`/admin/domicilio`** (nuova voce «Domicilio» nella barra):
  - **Impostazioni**: ordini totali per fascia (default 4), di cui massimo a domicilio (default 2), anticipo minimo in minuti (default 30), telefono del locale.
  - **Zone**: nome, costo di consegna, ordine minimo, attiva, posizione. Aggiunta e modifica; niente cancellazione, solo disattivazione: gli ordini conservano una copia di nome e costo.
  - **Orari**: per ogni giorno, Lunedì…Domenica, i turni di asporto e di domicilio (dalle–alle, più righe). Aggiunta e rimozione dei turni.
  - **Chiusure straordinarie**: data e motivo facoltativo. Aggiunta e rimozione.
  - Avviso in cima finché ci sono piatti disponibili con allergeni da confermare o ingredienti della poke senza allergeni confermati.
- **`/admin/poke`**: per ogni ingrediente, la scelta degli allergeni (i 14 della tappa 1) e la casella «Allergeni della poke confermati». Il composer mostra gli allergeni della poke in base alle scelte.

### 4.4 Sito statico (repo `carnedasosa/daniel-sushi`)

- «Ordina ora» (index, menu, crediti) → menù dell'app. I tre «Ordina» delle box → `…/#box`.
- L'indirizzo dell'app sta in **un solo punto** (`js/ordini.js`, costante `URL_ORDINI`). Lo script sostituisce l'`href` dei link marcati `data-ordina`. Finché la costante è vuota i link restano come oggi (`#dove`). Senza JavaScript i link vanno comunque a «Dove siamo».

## 5. Regole di dominio

### 5.1 Ordini aperti

Un servizio (asporto o domicilio) è **aperto ora** se valgono tutte queste condizioni. Il motivo mostrato è la prima che fallisce:

1. tutti i piatti disponibili hanno `allergeni_confermati` («Stiamo aggiornando le informazioni sugli allergeni: gli ordini online riapriranno presto»);
2. il telefono del locale è impostato («Ordini online non ancora attivi»);
3. `aperti_il` = data di oggi a Roma («Ordini online chiusi in questo momento»);
4. oggi non è una chiusura straordinaria («Oggi siamo chiusi»);
5. solo per il domicilio: esiste almeno una zona attiva («Consegne a domicilio non disponibili»);
6. esiste almeno una fascia prenotabile per quel servizio («Nessuna fascia libera per oggi»).

Con `ORDINI_CASA_PROVA=1` **e** `NODE_ENV !== 'production'` si salta solo la condizione 1, per le prove in locale. In produzione la variabile è ignorata, e un test lo verifica.

La **poke composta** si ordina da casa solo se è ordinabile (prezzi impostati) **e** `poke_config.allergeni_confermati`. Altrimenti, nel menù da casa, la card «Componi la tua poke» non compare.

### 5.2 Fasce

- Data di riferimento = oggi nel fuso `Europe/Rome`. Durata fissa: 15'.
- Per ogni turno del servizio nel giorno della settimana di oggi (1 = lunedì … 7 = domenica): inizi da `dalle` con passo 15', finché inizio < `alle`. I turni non attraversano la mezzanotte (`dalle < alle`); fasce duplicate da turni sovrapposti si fondono.
- L'istante di ogni fascia si calcola dall'ora locale di Roma, compreso il giorno del cambio d'ora. Si salva come `timestamptz`.
- **Prenotabile** se:
  - inizio ≥ adesso + anticipo minimo;
  - ordini attivi da casa (asporto + domicilio) in quella fascia < capacità totale;
  - per il domicilio, anche i domicili attivi in quella fascia < capacità consegne.
- «Attivi» = tutti gli stati tranne `rifiutato` e `annullato`.
- Il controllo si ripete **dentro la transazione d'invio**, dopo il lock della riga delle impostazioni: tutti gli invii da casa si mettono in fila. Due clienti non possono prendere l'ultimo posto insieme.

### 5.3 Stati

Asporto: `in_attesa` → `accettato` | `rifiutato`; `accettato` → `in_preparazione` → `pronto` → `completato`.
Domicilio: come l'asporto, ma `pronto` → `in_consegna` → `completato`.

- `rifiutato` solo da `in_attesa`. `annullato` da `accettato`, `in_preparazione`, `pronto`, `in_consegna`.
- Accettare con spostamento: la fascia diventa fascia + 15 o + 30 minuti.
- Ogni cambio di stato è condizionato allo stato atteso (`update … where stato = $atteso`): un doppio tocco non salta due passaggi.
- Tavolo invariato: `inviato` → `in_preparazione` → `servito`, `annullato`.

### 5.4 Prezzi e totali

- Righe ricalcolate dal DB come al tavolo (copie di nome, numero, prezzo; poke validata e prezzata sul server; un piatto non disponibile fa rifiutare l'intero ordine).
- Totale = somma delle righe + (domicilio) costo della zona. `consegna_cent` è salvato sull'ordine.
- Domicilio: somma delle righe ≥ minimo della zona, altrimenti errore con l'importo mancante.
- Il client invia il totale che ha mostrato; se non coincide con quello del server, l'ordine viene rifiutato con il totale nuovo.
- Annullare una riga ricalcola: totale = righe attive + consegna. Se non restano righe attive, l'ordine passa ad `annullato`.

### 5.5 Dati del checkout

- Nome: 1–60 caratteri dopo il trim.
- Telefono: tolti spazi, punti, trattini e parentesi, `+39`/`0039` facoltativo, poi 6–13 cifre. Si salva normalizzato.
- Email: 3–254 caratteri, formato `x@y.z`, salvata in minuscolo.
- Domicilio: indirizzo 5–200 caratteri, note facoltative fino a 200, zona attiva esistente.
- Pagamento `contanti` | `carta`. «Pago con» facoltativo, solo per i contanti, ≥ totale e ≤ 500,00 €.
- Privacy: casella obbligatoria. Si salva l'ora del consenso.
- Carrello: le stesse regole del tavolo (1–40 righe, quantità 1–20, nota ≤ 200).

### 5.6 Limiti anti-abuso

- Al massimo **3 ordini `in_attesa`** con lo stesso telefono.
- Al massimo **10 ordini da casa all'ora** dalla stessa rete (IPv4 o /64, con `ipDaHeaders` della tappa 2). Senza indirizzo si applica solo il limite per telefono.
- Invio idempotente con `chiave_invio`, come al tavolo: riprovare lo stesso carrello restituisce lo stesso ordine.

## 6. Architettura

### 6.1 Database — una migrazione additiva `20261013120000_domicilio_asporto.sql`

**`ordini` (estesa):**
- `tipo` ∈ `tavolo`, `asporto`, `domicilio`. `stato` ∈ stati del tavolo ∪ stati della casa, con vincolo di coerenza tipo/stato.
- Nuove colonne, valorizzate solo per la casa:
  - `token` (unico, 32 caratteri base64url, 192 bit casuali), `fascia timestamptz`;
  - `cliente_nome`, `cliente_telefono`, `cliente_email`;
  - `zona_id` (→ `zone_consegna`, `on delete set null`), `zona_nome`, `consegna_cent`, `indirizzo`, `note_consegna`;
  - `pagamento`, `contanti_da_cent`, `privacy_il`;
  - `motivo_rifiuto`, `rete`, `anonimizzato_il`.
- Vincoli:
  - un ordine `tavolo` ha la sessione e nessuna colonna della casa;
  - un ordine da casa non ha sessione, ha token, fascia, consegna (0 per l'asporto) e pagamento, e, se non anonimizzato, ha i dati del cliente;
  - un domicilio non anonimizzato ha indirizzo e zona.
- Indici: `(tipo, fascia)` per la capacità, `(cliente_telefono, stato)`, `(rete, creato_il)`, `(creato_il) where anonimizzato_il is null and tipo <> 'tavolo'`.
- I 3 ordini esistenti (tavolo) restano validi senza modifiche.

**Nuove tabelle:**
- `zone_consegna(id, nome, costo_cent, minimo_cent, attiva, posizione)`.
- `orari_casa(id, servizio, giorno 1–7, dalle time, alle time, check dalle < alle)`.
- `chiusure_casa(data primary key, motivo)`.
- `impostazioni_casa` (riga unica `id = 1`, già inserita con i default): `capacita_fascia`, `capacita_consegne` (≤ capacità totale), `anticipo_minuti`, `telefono`, `aperti_il date`.
- `email_ordini(id, ordine_id → ordini on delete cascade, tipo, creata_il, inviata_il, tentativi, ultimo_errore, in_invio_dal, unique(ordine_id, tipo))`.

**`poke_config` (estesa):** `allergeni_voci jsonb not null default '{}'` (`{ gruppo: { voce: codici[] } }`), `allergeni_confermati boolean not null default false`.

Tutte le nuove tabelle con RLS attiva, privilegi revocati ad `anon` e `authenticated`, nessuna policy. Sequenze comprese.

### 6.2 Moduli

- **Dominio puro** (`src/domain/`):
  - `ora-roma` (data e ora locali di Roma ↔ istanti);
  - `fasce` (generazione e prenotabilità);
  - `apertura-casa` (motivi del §5.1);
  - `stati-casa` (transizioni ed etichette per staff e cliente);
  - `checkout` (validazione dei dati del §5.5);
  - `totali-casa` (consegna, minimo, totale);
  - `allergeni-poke` (allergeni di una scelta, completezza);
  - `email-ordini` (oggetto, testo e HTML di ogni email, con l'escape dei dati).
- **Repository** (`src/casa/`):
  - `impostazioni-repo` (impostazioni, zone, orari, chiusure);
  - `ordini-casa-repo` (creazione transazionale, lettura per token, da accettare, cambi di stato, anonimizzazione);
  - `email-repo` (coda, presa in carico, esito).
  - `leggiOrdini` della tappa 2 passa a `left join` sulle sessioni e restituisce anche i campi della casa, così la cucina legge tavoli e casa con una sola funzione.
- **Invio email** (`src/casa/resend.ts`): `POST https://api.resend.com/emails` con `fetch`, `Authorization: Bearer RESEND_API_KEY`, `Idempotency-Key: <id riga email>`. Nessuna nuova dipendenza. `smaltisciCodaEmail(db)`:
  - prende in carico fino a 10 email non inviate, con meno di 5 tentativi, di ordini non anonimizzati, segnando `in_invio_dal` (riprendibile dopo 2');
  - invia e registra l'esito.
  - Si chiama con `after()` dopo l'invio di un ordine e dopo ogni azione staff che accoda un'email, e a ogni rendering di `/staff` (nuovi tentativi).
  - Senza `RESEND_API_KEY`, `EMAIL_MITTENTE` o `APP_URL` non fa nulla.
- **Anonimizzazione**: `GET /api/cron/anonimizza`, autorizzata solo con `Authorization: Bearer ${CRON_SECRET}` (401 se il segreto manca o non coincide).
  - Per gli ordini da casa con più di 12 mesi e non ancora anonimizzati: azzera nome, telefono, email, indirizzo, note di consegna, «pago con», rete e le note delle righe, imposta `anonimizzato_il`.
  - Idempotente, pianificata ogni giorno in `vercel.json` (`0 3 * * *`).
- **Pagine e azioni nuove**: `/` (menù ordinabile), `/ordina`, `/ordine/[token]`, `/privacy`, `/admin/domicilio`. Sezioni nuove in `/staff` e `/admin/poke`. Le azioni staff chiamano `richiediRuolo('staff')`, quelle admin `richiediRuolo('admin')`, come prima istruzione.
- **Componenti riusati**: card del piatto, carrello, composer della poke e `Pannello` della tappa 2, spostati in `src/ordinare/` e condivisi fra tavolo e casa. Il tavolo continua a funzionare identico.
- **Variabili d'ambiente nuove** (tutte solo server, facoltative): `RESEND_API_KEY`, `EMAIL_MITTENTE`, `CRON_SECRET`, `ORDINI_CASA_PROVA`. `APP_URL` serve anche per i link nelle email.

### 6.3 Errori e casi limite

- DB irraggiungibile al checkout: messaggio italiano. Il carrello resta salvato nel browser.
- Esito dell'invio incerto (rete caduta): «Non siamo sicuri che l'ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.»
- Token non valido o inesistente: 404.
- Un'email fallita non blocca mai l'ordine né l'azione dello staff. L'errore resta registrato sulla riga della coda.
- Schermo staff con DB giù: come oggi, ultimi dati visibili e nuovi tentativi automatici. Il suono per gli ordini in attesa riparte con i dati.

## 7. Test e verifica

- **Unità**:
  - fasce, compreso il 25/10/2026 (cambio d'ora) e i turni sovrapposti;
  - prenotabilità con le due capacità e l'anticipo;
  - motivi di apertura, compresa la variabile di prova ignorata in produzione;
  - transizioni di stato, totali e minimo zona, validazione del checkout, allergeni della poke, testi delle email con escape.
- **PGlite con tutte le migrazioni reali**:
  - creazione dell'ordine con fascia piena, tetto consegne raggiunto, minimo zona non raggiunto, totale cambiato, piatto esaurito;
  - invio ripetuto (stesso ordine), limiti anti-abuso;
  - accetta/+15/rifiuta/annulla con email in coda, doppio tocco;
  - annullamento di una riga con consegna;
  - lettura della cucina con tavolo e casa insieme;
  - presa in carico della coda email, anonimizzazione idempotente;
  - la migrazione applicata con ordini da tavolo già presenti.
- **Azioni** con mock: ruolo richiesto, errori del DB in italiano, `after` chiamato.
- **Componenti** principali: checkout, pagina dello stato, card da accettare.
- **Verifica del codice del piano**: tutto il codice del piano è scritto ed eseguito prima della consegna (suite completa, `tsc`, `eslint`, `next build` senza `.env.local`, prova nel browser in locale).
- **Prova reale**: ultimo task del piano, con il «sì» dell'utente per applicare la migrazione al DB reale. Flusso completo da due browser (cliente e staff) con `ORDINI_CASA_PROVA=1` in locale.

## 8. Fuori da questa tappa

Storico ordini con filtri in admin · cambio password staff dall'admin · annullamento da parte del cliente · ordini per i giorni successivi · pagamento online · SMS/WhatsApp · turni a cavallo della mezzanotte · TLS verso il pooler (tema separato già annotato).

## 9. Da chiedere a Daniel prima del go-live

Allergeni di piatti e ingredienti della poke (**bloccante**) · telefono · orari di asporto e domicilio · zone con costo e minimo · capacità per fascia e anticipo · prezzi della poke · dominio (per app, sito ed email) e indirizzo mittente · testo dell'informativa privacy.
