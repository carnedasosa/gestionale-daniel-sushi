# Serata tipo: 6 tavoli, 3–4 ordini a tavolo, 5 domicili — 17/10/2026

Prova automatica della serata che Daniel si aspetta nel locale: **6 tavoli con 3 o 4 ordini ciascuno** e **5 ordini a domicilio dal sito**, con cassa, banco sushi, cucina e telefono del cameriere ognuno sulla sua postazione. Gira sul **database finto** (PGlite di `e2e/db-locale.ts`, mai quello reale), con l'app compilata come in produzione. Si rilancia con `npm run serata` (circa 5 minuti con la compilazione, prima delle 22 di Roma; servono `E2E_EMAIL` ed `E2E_PASSWORD` in `.env.local`). Il registro completo finisce in `test-results/serata/risultati.json`.

Codice provato: `main` del 17/10 sera, con il numero d'ordine giornaliero (PR 22) e le correzioni dell'analisi architetturale (PR 21: limite dei tentativi per rete a 20, limiti di tempo sulle transazioni, controlli di coerenza in SQL).

Rispetto alla serata del 16/10 ([`2026-10-16-serata-quattro-dispositivi.md`](2026-10-16-serata-quattro-dispositivi.md)) cambiano i numeri dei clienti, non i dispositivi né gli imprevisti: prima ogni tavolo mandava da 2 a 12 ordini e dal sito arrivavano 3 asporti e 2 domicili. Da oggi lo scenario impone 3–4 ordini per tavolo e 5 domicili, e due controlli finali lo verificano.

## Chi c'era

- **Tablet della cassa** (postazione Cassa) con quattro schede: **Tavoli** (apre e chiude i tavoli, sblocca i codici), **Ordini** (accetta o rifiuta gli ordini da casa, «Segna partito/consegnato/ritirato», «Portate» per bevande e piatti pronti), **Menù** (segna l'Edamame esaurito) e **Nuovo ordine** (un asporto al telefono e un domicilio su WhatsApp).
- **Tablet del banco sushi** e **tablet della cucina**: solo le proprie comande, «Inizia a preparare» e «Segna pronta».
- **Telefono del cameriere** (postazione Sala, 375 px): ordina per il Tavolo 5 dal dettaglio del tavolo.
- **6 tavoli**, 18 telefoni in tutto, 3–4 ordini per tavolo; i tavoli dispari chiudono col dolce.
- **5 clienti dal sito, tutti a domicilio** (uno rifiutato dalla cassa), più i **2 ordini presi dalla cassa**.

## Esito

**Superato: 31 ordini in tutto, 0 problemi, 0 osservazioni, 0 richieste lente (oltre 2,5 s), 0 richieste fallite.** Durata della serata: 188 s.

| Da dove | Ordini | Note |
|---|---|---|
| Tavoli (6) | 24 | 4 per tavolo (al Tavolo 5: 3 dai clienti + 1 del cameriere) |
| Sito, a domicilio | 5 | 4 consegnati, 1 rifiutato |
| Cassa | 2 | 1 asporto al telefono, 1 domicilio su WhatsApp |

Conti chiusi: Tavolo 1 58,00 € · Tavolo 2 70,00 € · Tavolo 3 71,00 € · Tavolo 4 91,00 € · Tavolo 5 45,00 € (compresa la comanda del cameriere) · Tavolo 6 51,00 €.

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
| Cassa | 30 | 2,1 s | 4,5 s | 4,9 s |
| Banco sushi | 27 | 2,6 s | 4,8 s | 45,0 s (nota 1) |
| Cucina | 15 | 2,6 s | 4,7 s | 4,7 s |
| Cassa dopo 40 s di standby | 1 | 40,6 s | | (voluto: vedi imprevisti) |

Dalla nascita della comanda, registrati nel database:

| Reparto | Comande | Inizio: mediana / 95% | Pronta: mediana / 95% / massimo |
|---|---|---|---|
| Banco sushi | 27 | 3,3 s / 7,2 s | 5,0 s / 11,5 s / 46,0 s (nota 1) |
| Cucina | 15 | 3,4 s / 6,5 s | 5,0 s / 6,9 s / 6,9 s |
| Sala (bevande, fino a «Portate») | 6 | — | 4,2 s / 5,2 s / 5,2 s |

| Altro | Mediana | 95% entro | Massimo |
|---|---|---|---|
| Invio dal tavolo | 0,33 s | 0,44 s | 2,0 s (il telefono senza rete, con la ripetizione) |
| Invio dal telefono del cameriere | 0,55 s | | |
| Invio dal sito | 0,10 s | 0,12 s | 0,12 s |
| Invio dalla cassa | 0,20 s | | |
| Apertura del menù dal sito | 0,19 s | 0,24 s | 0,24 s |
| Ingresso al tavolo col codice | 0,45 s | 0,80 s | 0,80 s |

I tempi di preparazione sono quelli di una cucina simulata che tocca un bottone ogni 0,3–0,9 s: misurano il percorso, non un sushi chef. Sono presi su un solo computer con il database finto; con Vercel e Supabase veri saranno un po' più alti.

1. Il massimo del banco è il domicilio arrivato mentre il tablet della cassa era in standby: il banco vede gli ordini da casa solo dopo l'accettazione, e la cassa l'ha accettato al risveglio. Comportamento voluto.

## Imprevisti provati

| Imprevisto | Cosa è successo |
|---|---|
| Doppio tocco su «Invia ordine» (Tavolo 2) | Un solo ordine. |
| La risposta del server si perde dopo l'invio (Tavolo 4) | «Non siamo sicuri che l'ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.»; al nuovo tentativo nessun doppione. |
| Telefono senza rete all'invio (Tavolo 5) | Stesso messaggio; tornata la rete, l'ordine parte una volta sola. |
| 5 codici sbagliati (Tavolo 3) | Il telefono che ha sbagliato viene bloccato; la cassa vede «5 codici sbagliati» sulla piastrella e sblocca dal dettaglio. **Il vicino col codice giusto entra lo stesso**: con il limite per rete a 20 i suoi 5 errori non bloccano più il tavolo (nelle serate del 14 e del 16/10 lo bloccavano). |
| Edamame esaurito mentre è nel carrello (Tavolo 6) | «Alcuni piatti non sono più disponibili: Edamame»; il resto parte al secondo invio. |
| Tavolo chiuso con un carrello ancora pieno (Tavolo 1) | L'ordine non passa; il telefono mostra «Il tavolo è chiuso, grazie per essere stati da noi!». |
| Tablet della cassa in standby per 40 s | Nascosto non si aggiorna (previsto); al risveglio il domicilio nuovo compare in 0,1 s. |
| Domicilio rifiutato dalla cassa | Il cliente vede «Rifiutato»; l'ordine non occupa più la fascia. |
| Accetta, +15’, +30’ | L'ordine passa alla fascia spostata e libera il posto in quella di partenza; banco e cucina vedono l'orario nuovo. |
| Cinque domicili con 2 consegne per fascia | I primi due hanno preso le 19:00; dal terzo il sito mostrava le 19:00 piene e proponeva le 19:15. Il domicilio dettato alla cassa a fine serata ha avuto le 19:30 perché anche le 19:15 erano piene. |
| Comanda del cameriere mentre i clienti ordinano | Arriva divisa tra banco, cucina e striscia delle bevande; «Ordinato finora» la segna «Dal cameriere»; il conto torna. |
| Numero d'ordine giornaliero | Cassa, banco, cucina, telefono al tavolo e pagina dell'ordine da casa mostrano lo stesso numero; su un database nuovo coincide col contatore globale, quindi i controlli sul database restano validi. |

## Osservazioni

Nessun problema e nessuna osservazione nei controlli. Da tenere a mente:

1. **«Accetta +15’» sposta la fascia dell'ordine**: libera il posto nella fascia di partenza e lo occupa in quella nuova. È coerente con lo schermo, ma va detto a Daniel: se accetta tutto con +30’, la fascia dopo si riempie e il sito la chiude ai clienti.
2. **Non provato qui**: suoni, dispositivi veri su una rete vera, stampa del conto, email (spente senza dominio), Vercel e Supabase veri.

## Prima di darlo a Daniel

La simulazione dice che il percorso ordini regge la serata tipo senza perdere o doppiare nulla, e che il blocco dei codici sbagliati non colpisce più i vicini di tavolo. Quello che solo la sala può dire è nella lista «Da provare in sala con Daniel» del verbale del 16/10: postazioni sui dispositivi veri, suoni al bancone e in cucina, copertura Wi-Fi, tempi della ragazza alla cassa su `/staff/nuovo-ordine`, chi tocca «Portate».
