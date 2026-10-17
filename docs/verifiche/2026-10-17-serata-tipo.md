# Serata tipo: 6 tavoli, 3–4 ordini a tavolo, 5 domicili — 17/10/2026

Prova automatica della serata che Daniel si aspetta nel locale: **6 tavoli con 3 o 4 ordini ciascuno** e **5 ordini a domicilio dal sito**, con cassa, banco sushi, cucina e telefono del cameriere ognuno sulla sua postazione. Gira sul **database finto** (PGlite di `e2e/db-locale.ts`, mai quello reale), con l'app compilata come in produzione. Si rilancia con `npm run serata` (circa 5 minuti con la compilazione, prima delle 22 di Roma; servono `E2E_EMAIL` ed `E2E_PASSWORD` in `.env.local`). Il registro completo finisce in `test-results/serata/risultati.json`.

Rispetto alla serata del 16/10 ([`2026-10-16-serata-quattro-dispositivi.md`](2026-10-16-serata-quattro-dispositivi.md)) cambiano i numeri dei clienti, non i dispositivi né gli imprevisti: prima ogni tavolo mandava da 2 a 12 ordini e dal sito arrivavano 3 asporti e 2 domicili. Da oggi lo scenario impone 3–4 ordini per tavolo e 5 domicili, e due controlli finali lo verificano.

## Chi c'era

- **Tablet della cassa** (postazione Cassa) con quattro schede: **Tavoli** (apre e chiude i tavoli, sblocca i codici), **Ordini** (accetta o rifiuta gli ordini da casa, «Segna partito/consegnato/ritirato», «Portate» per bevande e piatti pronti), **Menù** (segna l'Edamame esaurito) e **Nuovo ordine** (un asporto al telefono e un domicilio su WhatsApp).
- **Tablet del banco sushi** e **tablet della cucina**: solo le proprie comande, «Inizia a preparare» e «Segna pronta».
- **Telefono del cameriere** (postazione Sala, 375 px): ordina per il Tavolo 5 dal dettaglio del tavolo.
- **6 tavoli**, 15 telefoni in tutto, 3–4 ordini per tavolo; i tavoli dispari chiudono col dolce.
- **5 clienti dal sito, tutti a domicilio** (uno rifiutato dalla cassa), più i **2 ordini presi dalla cassa**.

## Esito

**Superato: 30 ordini in tutto, 0 problemi, 0 richieste lente (oltre 2,5 s), 0 richieste fallite.** Durata della serata: 189 s.

| Da dove | Ordini | Note |
|---|---|---|
| Tavoli (6) | 23 | Tavolo 1: 4 · Tavolo 2: 4 · Tavolo 3: 3 · Tavolo 4: 4 · Tavolo 5: 3 + 1 del cameriere · Tavolo 6: 4 |
| Sito, a domicilio | 5 | 4 consegnati, 1 rifiutato |
| Cassa | 2 | 1 asporto al telefono, 1 domicilio su WhatsApp |

Conti chiusi: Tavolo 1 38,00 € · Tavolo 2 41,00 € · Tavolo 3 67,00 € · Tavolo 4 56,00 € · Tavolo 5 41,50 € (compresa la comanda del cameriere) · Tavolo 6 58,00 €.

Controlli sul database a fine serata, tutti passati:
- ogni ordine confermato al cliente è nel database con lo stesso totale; nessun doppione (una chiave d'invio per ordine);
- il totale di ogni ordine è la somma delle sue righe; il conto di ogni tavolo è la somma degli ordini confermati;
- tutti gli ordini al tavolo «servito», tutti quelli da casa «completato» o «rifiutato», nessun tavolo rimasto aperto;
- comande: una per reparto toccato (da casa senza quella delle bevande), tutte «pronta» o «annullata», nessuna bevanda rimasta da portare;
- origine: i 2 ordini della cassa hanno origine `cassa` e nessuna email in coda, quello del cameriere `cameriere`, gli altri `cliente`;
- **nuovi**: ogni tavolo ha mandato 3 o 4 ordini dai clienti; i domicili dal sito sono esattamente 5.

### Tempi

Dall'invio al primo momento in cui l'ordine compare sullo schermo (gli schermi si aggiornano ogni 5 secondi):

| Schermo | Ordini | Mediana | 95% entro | Massimo |
|---|---|---|---|---|
| Cassa | 28 | 1,8 s | 4,7 s | 5,1 s |
| Banco sushi | 22 | 2,6 s | 5,4 s | 44,9 s (nota 1) |
| Cucina | 17 | 3,0 s | 5,2 s | 5,2 s |
| Cassa dopo 40 s di standby | 1 | 40,4 s | | (voluto: vedi imprevisti) |

Dalla nascita della comanda, registrati nel database:

| Reparto | Comande | Inizio: mediana / 95% | Pronta: mediana / 95% / massimo |
|---|---|---|---|
| Banco sushi | 22 | 3,5 s / 5,5 s | 4,8 s / 7,5 s / 45,9 s (nota 1) |
| Cucina | 17 | 3,1 s / 5,6 s | 4,3 s / 6,5 s / 6,5 s |
| Sala (bevande, fino a «Portate») | 4 | — | 4,7 s / 8,9 s / 8,9 s |

| Altro | Mediana | 95% entro | Massimo |
|---|---|---|---|
| Invio dal tavolo | 0,33 s | 0,49 s | 2,0 s (il telefono senza rete, con la ripetizione) |
| Invio dal telefono del cameriere | 0,68 s | | |
| Invio dal sito | 0,09 s | 0,14 s | 0,14 s |
| Invio dalla cassa | 0,21 s | | |
| Apertura del menù dal sito | 0,22 s | 0,24 s | 0,24 s |
| Ingresso al tavolo col codice | 0,45 s | 0,66 s | 0,66 s |

I tempi di preparazione sono quelli di una cucina simulata che tocca un bottone ogni 0,3–0,9 s: misurano il percorso, non un sushi chef. Sono presi su un solo computer con il database finto; con Vercel e Supabase veri saranno un po' più alti.

1. Il massimo del banco è il domicilio arrivato mentre il tablet della cassa era in standby: il banco vede gli ordini da casa solo dopo l'accettazione, e la cassa l'ha accettato al risveglio. Comportamento voluto.

## Imprevisti provati

| Imprevisto | Cosa è successo |
|---|---|
| Doppio tocco su «Invia ordine» (Tavolo 2) | Un solo ordine. |
| La risposta del server si perde dopo l'invio (Tavolo 4) | «Non siamo sicuri che l'ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.»; al nuovo tentativo nessun doppione. |
| Telefono senza rete all'invio (Tavolo 5) | Stesso messaggio; tornata la rete, l'ordine parte una volta sola. |
| 5 codici sbagliati (Tavolo 3) | Telefono bloccato; la cassa vede «5 codici sbagliati» sulla piastrella e sblocca dal dettaglio. Il vicino col codice giusto era bloccato anche lui (stessa rete: vedi sotto). |
| Edamame esaurito mentre è nel carrello (Tavolo 6) | «Alcuni piatti non sono più disponibili: Edamame»; il resto parte al secondo invio. |
| Tavolo chiuso con un carrello ancora pieno (Tavolo 1) | L'ordine non passa; il telefono mostra «Il tavolo è chiuso, grazie per essere stati da noi!». |
| Tablet della cassa in standby per 40 s | Nascosto non si aggiorna (previsto); al risveglio il domicilio nuovo compare in 0,1 s. |
| Domicilio rifiutato dalla cassa | Il cliente vede «Rifiutato»; l'ordine non occupa più la fascia. |
| Accetta, +15’, +30’ | L'ordine passa alla fascia spostata (es. «Domicilio 18:45» diventa «Domicilio 19:15») e libera il posto in quella di partenza. |
| Cinque domicili con 2 consegne per fascia | Nessun cliente ha trovato la fascia piena: i primi accettati con +15’/+30’ erano già usciti dalla 18:45. Il domicilio dettato alla cassa a fine serata ha avuto la 19:00 perché la 18:45 era piena. |
| Comanda del cameriere mentre i clienti ordinano | Arriva divisa tra banco, cucina e striscia delle bevande; «Ordinato finora» la segna «Dal cameriere»; il conto torna. |

## Osservazioni

Nessun problema nei controlli. Restano le osservazioni delle serate precedenti:

1. **Il limite dei tentativi per rete blocca anche i vicini di tavolo**: sul Wi-Fi del locale i telefoni hanno lo stesso indirizzo, e dopo i 5 errori di un cliente anche chi scrive il codice giusto legge «Troppi tentativi…» finché il cameriere non preme «Sblocca».
2. **«Accetta +15’» sposta la fascia dell'ordine**: libera il posto nella fascia di partenza e lo occupa in quella nuova. È coerente con lo schermo (banco e cucina vedono l'orario spostato), ma va detto a Daniel: se accetta tutto con +30’, la fascia dopo si riempie e il sito la chiude ai clienti.
3. **Non provato qui**: suoni, dispositivi veri su una rete vera, stampa del conto, email (spente senza dominio), Vercel e Supabase veri.

## Prima di darlo a Daniel

La simulazione dice che il percorso ordini regge la serata tipo senza perdere o doppiare nulla. Quello che solo la sala può dire è nella lista «Da provare in sala con Daniel» del verbale del 16/10: postazioni sui dispositivi veri, suoni al bancone e in cucina, copertura Wi-Fi, limite dei tentativi per rete, tempi della ragazza alla cassa su `/staff/nuovo-ordine`, chi tocca «Portate».
