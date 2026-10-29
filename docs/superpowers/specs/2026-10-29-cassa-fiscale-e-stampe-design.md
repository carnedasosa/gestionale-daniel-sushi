# Cassa, fiscale e stampe — analisi e design

Data: 2026-10-29 · Stato: in lavorazione (branch `cassa-fiscale-stampe`) · Spec precedente: [`2026-10-16-reparti-e-cassa-design.md`](2026-10-16-reparti-e-cassa-design.md)

## 1. Da dove nasce

Incontro del 29/10 con Daniele (Daniel's Sushi). Il gestionale gli piace; prima di chiudere l'accordo chiede:

1. **pre-conto** e **numero dei coperti**;
2. **foto dei piatti** nel menù e un **menù dei vini**;
3. la **parte fiscale**: lo scontrino stampato dal gestionale;
4. la **divisione del conto** (alla romana e per piatti);
5. **niente tablet** in cucina e al banco sushi: le comande escono **stampate su carta, una stampante per reparto**.

Il prezzo non è stato discusso.

## 2. Come lavora oggi il gestionale (punti toccati)

- **Conto** (`/staff/conto/[sessione]`, `contoSessione`): voci raggruppate per nome/numero/prezzo/poke, totale ricalcolato dal DB, avviso se arrivano ordini dopo l'apertura della pagina, «Stampa» dal browser con la scritta «non è uno scontrino fiscale». Nessun coperto, nessun pagamento registrato.
- **Comande per reparto** (`comande`, `src/comande/comande-repo.ts`): una per reparto (`banco`, `cucina`, `sala`), nate nella transazione dell'ordine; da casa nascono anche per gli ordini `in_attesa`, ma i reparti le vedono solo dopo l'accettazione. Banco e cucina le portano avanti dal tablet; la cassa ha i bottoni d'emergenza a cascata.
- **Menù** (`piatti`, `categorie`): l'admin modifica i piatti esistenti ma **non può crearne di nuovi**; nessuna immagine; le bevande sono una categoria `beverage` (reparto `sala`), niente vini.
- **Dati**: SQL diretto dal server, nessuno storage di file, nessun servizio esterno oltre a Supabase Auth e Resend.

## 3. Vincoli esterni (verificati il 29/10)

- **Scontrino = documento commerciale emesso da un Registratore Telematico (RT)** omologato, che memorizza e trasmette i corrispettivi all'Agenzia delle Entrate. Un'app web **non può** emettere lo scontrino da sola: deve comandare l'RT del locale. L'aliquota IVA sta nei **reparti fiscali** programmati nell'RT (es. reparto 1 = 10% somministrazione): il gestionale manda il numero di reparto, non calcola l'IVA.
- **Collegamento POS–RT** obbligatorio dal 1° gennaio 2026: è un'associazione fatta sul portale dell'Agenzia delle Entrate (anche i POS portatili al tavolo), non un collegamento software. Non tocca il gestionale; va ricordato a Daniele/commercialista ([TeamSystem](https://www.teamsystem.com/magazine/horeca/collegamento-pos-registratore-telematico/), [edotto](https://www.edotto.com/articolo/collegamento-pos-e-rt-2026-chiarimenti-entrate-su-obblighi-esoneri-e-pos-unico)).
- **Protocollo Epson RT** (FP-81 II RT, FP-90 III RT, i più diffusi): `POST http://<ip>/cgi-bin/fpmate.cgi` con busta SOAP e `<printerFiscalReceipt>`: `beginFiscalReceipt`, `printRecItem description quantity unitPrice department`, `printRecTotal payment paymentType index` (0 contanti, 2 carta), `endFiscalReceipt`. Verificato sul driver aperto OCA `fiscal_epos_print` (Odoo, in produzione in Italia). Altre marche (RCH, Custom, Olivetti, Ditron) hanno protocolli propri.
- **Stampanti termiche delle comande**: lo standard di fatto è **ESC/POS** in rete sulla porta TCP 9100 (Epson TM-T20/m30, e i compatibili). Le Epson TM-i/TM-m30III hanno anche «Server Direct Print» (la stampante interroga un URL), ma solo su quei modelli.
- **Il browser non può parlare con le stampanti del locale**: la pagina è in HTTPS su Vercel, le stampanti sono in HTTP sulla rete locale (contenuto misto bloccato, e Chrome chiede il permesso per le richieste verso la rete locale). Inoltre le comande devono uscire anche se nessun tablet è acceso.

## 4. Scelte di architettura

### 4.1 Una coda di stampa nel DB e un «ponte» nel locale

Tutto ciò che va su carta (comande, annulli, pre-conto, scontrini) diventa una riga nella tabella **`stampe`**, scritta **nella stessa transazione** dell'evento che la genera (ordine inviato, ordine da casa accettato, riga annullata, pre-conto, pagamento). Un piccolo programma, il **ponte di stampa** (`scripts/ponte-stampa.ts`, Node senza dipendenze), gira sul PC della cassa (o un Raspberry), chiede i lavori al server ogni 2 secondi in HTTPS con un token segreto e li manda alle stampanti della rete locale:

```
 telefoni/cassa ──► Vercel (Next) ──► Postgres: ordini + comande + stampe (stessa transazione)
                                          ▲
              ponte di stampa (PC cassa) ─┘  GET /api/stampa/coda  ·  POST /api/stampa/esito
                 │ ESC/POS :9100 ──► stampante banco, stampante cucina, stampante cassa
                 └ HTTP fpmate.cgi ──► RT Epson (scontrino)
```

Perché così:
- **nessuna comanda persa**: se il ponte o la stampante sono spenti, i lavori restano in coda e partono alla riaccensione; la cassa vede l'allarme;
- **niente HTTPS→HTTP dal browser** e nessun tablet acceso necessario;
- **indipendente dalla marca**: il ponte traduce un documento di stampa neutro (righe, grassetto, grande, centrato, taglio) in ESC/POS; Server Direct Print o altri RT si aggiungono come altri «traduttori» della stessa coda.

Scartati: stampa dal browser con `window.print()` (una sola stampante per dispositivo, finestra di dialogo, serve il tablet acceso); servizi cloud di stampa a pagamento; Server Direct Print come unica via (lega Daniele a due modelli Epson).

**Presa in carico atomica**: `update stampe set stato='in_stampa' … where id in (select id … for update skip locked limit N)`. Dopo 60 s senza esito un lavoro **non fiscale** torna in coda (al più una ristampa doppia, accettabile per una comanda). Un lavoro **fiscale** non torna mai in coda da solo: un secondo invio rischierebbe un secondo scontrino; resta «esito incerto» e la cassa controlla sull'RT e decide (segna emesso / rimanda).

**Sicurezza**: le API della coda rispondono solo con `Authorization: Bearer <STAMPA_TOKEN>` (variabile d'ambiente sul server, confronto a tempo costante); se la variabile manca rispondono 503. I lavori contengono solo ciò che va su carta.

**Allarme alla cassa**: le richieste del ponte aggiornano `ponte_stampa.visto_il` (al più ogni 10 s). Lo schermo della cassa mostra «Stampanti scollegate» se il ponte non si fa vivo da più di 30 s **o** se un lavoro aspetta da più di 30 s, e dà «Ristampa» per ordine.

### 4.2 Comande stampate per reparto

- Per ogni reparto un'impostazione **«stampa le comande»** (banco, cucina; sala = bevande, facoltativa, sulla stampante della cassa). Le comande si accodano quando l'ordine **entra in preparazione**: al tavolo all'invio, da casa all'accettazione (gli ordini della cassa nascono accettati).
- Il biglietto: reparto in grande, tavolo o «Asporto/Domicilio + nome + orario», numero del giorno, ora, righe `quantità × numero nome` in grande, note e scelte della poke, «Altri reparti: cucina 2».
- **Annulli**: se si annulla una riga o un ordine la cui comanda è già in coda/stampata, al reparto esce un biglietto **ANNULLATO** con le righe tolte.
- **Stati con le comande su carta** (banco e cucina non toccano schermi, quindi nessuno segna «pronta»). Regola:
  - quando il ponte conferma la stampa, la comanda passa a **`in_preparazione`** e prende `stampata_il` (vero: il reparto ha il biglietto in mano; il cliente vede «In preparazione», non un «Servito» falso);
  - la striscia **«Da portare al tavolo»** di cassa e sala mostra anche le comande stampate dei tavoli; **«Portate»** le porta a `pronta` con `portata_il`, e l'ordine diventa «Servito» come oggi;
  - **chiusura del tavolo**: una comanda già stampata non conta come «ancora in cucina» (il gestionale non può saperlo); restano l'avviso per gli ordini arrivati dopo il conto e quello per le comande non ancora stampate;
  - da casa la cassa usa i bottoni che ha già («Segna pronto», «Partito», «Ritirato»).
  I tablet restano possibili reparto per reparto: con «stampa le comande» spento tutto funziona come oggi (default del DB di prova, così e2e e serata non cambiano).
- **Agganci**: al tavolo in `creaOrdineTavolo` dopo `creaComande`; da casa in `accettaOrdine` **dopo** lo spostamento della fascia (+15/+30, così il biglietto mostra l'orario giusto) e alla creazione per `origine='cassa'`. Annulli: dove le comande perdono righe (`ricalcolaOrdine`, `annullaOrdine`, ordini da casa annullati), un biglietto per coppia ordine/reparto; se il lavoro della comanda è ancora in coda si toglie la riga dal lavoro (o il lavoro intero) invece di stampare due biglietti.
- Instradamento e formato sono **puri** (`src/stampa/`): lavoro → stampante, documento neutro → byte ESC/POS, testati; il ponte fa solo trasporto.
- Il segnale di vita del ponte sta in una tabella a sé (`ponte_stampa`), aggiornata al più ogni 10 s.

### 4.3 Coperti e pre-conto

- `sessioni_tavolo.coperti` (1–99, facoltativo) e `sessioni_tavolo.coperto_cent` (prezzo del coperto **fissato** quando si imposta il numero: cambiare il prezzo in admin non tocca i tavoli aperti). Si chiedono all'apertura del tavolo (campo facoltativo) e si correggono dal conto.
- `impostazioni_cassa.coperto_cent` (default **0**: coperto non addebitato, solo contato) e `reparto_fiscale_coperto`.
- Il conto mostra la riga «Coperto × N»; il totale la include. Il coperto entra in **tutti** i totali di sessione: `contoSessione`, `riepiloghiTavoli` (tile «Totale finora»), il riferimento di `ChiusuraConto`, il pre-conto e il residuo dei pagamenti (un test confronta conto e riepilogo con coperto > 0).
- **Pre-conto**: bottone nel conto che accoda alla stampante della cassa un biglietto «PRECONTO — non fiscale» con voci, coperti, totale e, se impostata, la quota a persona; segna `sessioni_tavolo.preconto_il`. Il conto avvisa se dopo il pre-conto sono arrivati altri ordini. Resta «Stampa» dal browser come riserva.

### 4.4 Divisione del conto e pagamenti

- Logica pura in `src/domain/divisione-conto.ts`, a centesimi interi:
  - **alla romana**: `allaRomana(totale, persone)` → quote che sommano **esattamente** il totale (i centesimi di resto vanno alle prime quote);
  - **per piatti**: si scelgono le porzioni (anche una sola delle tre di una voce); la quota = somma delle porzioni scelte + coperti scelti.
- Tabella **`pagamenti`**: `sessione_id` *oppure* `ordine_id` (da casa), importo, metodo (`contanti`/`carta`), descrizione («Quota 1 di 4», «Piatti scelti»), dettaglio delle porzioni (jsonb), chi l'ha registrato. Il server rifiuta un pagamento oltre il residuo (lock sulla sessione, stesso ordine dei lock di oggi).
- Il conto mostra **pagato / resta da pagare**. Chiudere il tavolo con un residuo resta possibile (oggi il gestionale non registra i pagamenti, e il residuo non blocca), ma il conto lo segnala.
- Le porzioni pagate «per piatti» si segnano come pagate nella vista di divisione, così la seconda persona non le ripaga.

### 4.5 Scontrino (modulo fiscale)

- `categorie.reparto_fiscale` (1–99, default 1) e `impostazioni_cassa.reparto_fiscale_coperto`. Il **valore dell'aliquota resta nell'RT**: in admin si scrive solo quale reparto RT usare (Daniele/commercialista sanno quale reparto è al 10% e quale al 22%).
- `src/fiscale/documento.ts` (puro): da un pagamento costruisce il **documento commerciale** = righe (descrizione ≤ 38 caratteri, quantità, prezzo unitario, reparto fiscale) + pagamento (contanti/carta). Regole:
  - pagamento del **conto intero** o **per piatti**: le righe vere (piatto per piatto, coperto);
  - quota **alla romana**: una riga per reparto fiscale «Quota 1/4 tavolo 5», ripartita in proporzione agli importi dei reparti (resto con il metodo dei resti maggiori), così l'IVA resta giusta anche con aliquote diverse;
  - somma righe = importo pagato, sempre (controllato e testato).
- `src/fiscale/epson.ts` (puro): documento → XML `fpmate.cgi` (escape XML, importi con il punto e due decimali, `paymentType` 0/2).
- Il pagamento ha uno **stato fiscale**: `non_richiesto` (pagato senza scontrino dal gestionale, es. battuto a mano sull'RT), `in_coda`, `emesso` (numero, data e chiusura Z restituiti dall'RT), `errore`, `incerto`. «Emetti scontrino» accoda un lavoro fiscale; il ponte lo manda all'RT e riporta l'esito.
- **Fuori da questa tappa**: annullo/reso fiscale (si fa sull'RT come oggi), lotteria degli scontrini, chiusura giornaliera Z dal gestionale, fatture.
- Con nessun RT configurato il ponte ha la modalità **prova** (scrive l'XML in un file invece di mandarlo): serve per provare tutto senza Daniele.

### 4.6 Foto dei piatti

- Tabella `foto_piatti(piatto_id, dati bytea, tipo, larghezza, altezza, versione)`. Il browser dell'admin **rimpicciolisce** la foto (lato lungo 800 px, WebP) prima di inviarla; il server accetta solo WebP/JPEG/PNG riconosciuti dai primi byte e al massimo 400 KB.
- Le foto si servono da `GET /foto/[piatto]/[versione]` con cache pubblica di un anno (`immutable`): la CDN di Vercel le tiene, il DB le legge una volta per versione. La versione cambia a ogni sostituzione.
- Scartati Supabase Storage e Vercel Blob: nuove chiavi segrete e un secondo posto dove stanno i dati, per ~150 foto da 40–80 KB (≈10 MB sui 500 MB del piano gratuito). Restare in Postgres tiene tutto testabile su PGlite.
- Le card del menù (cliente, tavolo, casa, cameriere) mostrano la foto se c'è, con `loading="lazy"` e dimensioni fisse (niente salti della pagina).

### 4.7 Menù dei vini

- `categorie.tipo` (`piatti` | `vini`, default `piatti`) e una categoria nuova **`vini`** («Carta dei vini», reparto `sala`, dopo le bevande).
- Sui piatti, campi del vino facoltativi: **tipologia** (bollicine, bianco, rosato, rosso, dolce), **cantina**, **denominazione** (es. «Falanghina del Sannio DOC»), **annata**, **formato** (bottiglia 0,75, mezza 0,375, calice). Un vino venduto anche al calice = due voci (bottiglia e calice) con due prezzi: niente varianti di prezzo dentro una voce, così carrello, conto e scontrino non cambiano.
- Nel menù la categoria vini si mostra raggruppata per tipologia, con cantina, denominazione, annata e formato.
- In admin: **«Nuovo piatto»** in qualsiasi categoria (oggi manca), con i campi del vino se la categoria è di tipo vini; per i vini gli allergeni partono da «solfiti».

## 5. Scelte di prodotto prese per ora (da confermare con Daniele)

| Tema | Scelta di default | Dove si cambia |
|---|---|---|
| Prezzo del coperto | 0 € (si contano i coperti, non si addebitano) | admin → Cassa e stampe |
| Coperti all'apertura | facoltativi | — |
| Comande delle bevande | non stampate (le prende la sala) | admin → Cassa e stampe |
| Reparto fiscale | 1 per tutto (somministrazione 10%) | admin → menù, categoria |
| Vini ordinabili da casa | sì, come le birre | — |
| Chiusura con residuo da pagare | permessa, segnalata | — |

## 6. Cosa serve dal locale (domande per Daniele)

1. **Marca e modello del registratore telematico** e indirizzo IP in rete; quali reparti fiscali ha programmati (10%, 22%) e con quale indice è programmato il pagamento elettronico (carta/bancomat). Se non è Epson serve il protocollo di quella marca.
2. **Stampanti delle comande**: modello (meglio termiche 80 mm con rete), una al banco e una in cucina, e la stampante del pre-conto alla cassa (può essere la stessa dell'RT? di solito no: l'RT stampa solo documenti fiscali).
3. Un **PC o Raspberry sempre acceso** nel locale per il ponte (la cassa già c'è).
4. Il **coperto**: quanto e se si addebita.
5. **Carta dei vini**: elenco con cantina, annata, prezzi bottiglia/calice.
6. **Foto dei piatti**.
7. Collegamento POS–RT sul portale AdE: a cura di Daniele/commercialista.

## 7. Migrazioni e rilascio

Nuove migrazioni (tutte additive, i dati esistenti restano validi): coperti e impostazioni cassa, pagamenti, coda di stampa, reparti fiscali e stato fiscale, foto, vini. **Vanno autorizzate e applicate al DB reale prima del merge**: `main` va in produzione da solo. Variabile nuova su Vercel: `STAMPA_TOKEN` (la inserisce l'utente).

## 8. Piano dei commit

1. Coperti e impostazioni della cassa.
2. Divisione del conto e pagamenti.
3. Foto dei piatti.
4. Menù dei vini e «Nuovo piatto».
5. Coda di stampa, biglietti ESC/POS, API e ponte.
6. Comande stampate per reparto e annulli.
7. Pre-conto.
8. Scontrino: reparti fiscali, documento commerciale (neutro rispetto alla marca), driver Epson sottile.
9. README, verbale delle prove.

La parte che dipende dall'hardware (ponte, driver Epson) va per ultima: finché Daniele non dice marca e modello di RT e stampanti è un'ipotesi ragionata, mentre documento commerciale, divisione e instradamento sono neutri e testati.

Ogni passo con i suoi test (dominio puro, repository su PGlite, azioni con `richiediRuolo` per primo); in fondo typecheck, lint, `npm test`, `npm run e2e`.
