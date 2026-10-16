# Serata a quattro dispositivi — 16/10/2026

Prova automatica di una serata intera nel locale com'è oggi: cassa, banco sushi, cucina e telefono del cameriere, ognuno con la sua postazione. Gira sul **database finto** (PGlite di `e2e/db-locale.ts`, mai quello reale), con l'app compilata come in produzione. Si rilancia con `npm run serata` (circa 5 minuti con la compilazione, prima delle 22 di Roma; servono `E2E_EMAIL` ed `E2E_PASSWORD` in `.env.local`). Il registro completo finisce in `test-results/serata/risultati.json`. Specifica: [`2026-10-16-reparti-e-cassa-design.md`](../superpowers/specs/2026-10-16-reparti-e-cassa-design.md). Serata precedente (un solo tablet in cucina): [`2026-10-14-serata-simulata.md`](2026-10-14-serata-simulata.md).

## Chi c'era

- **Tablet della cassa** (postazione Cassa), con quattro schede aperte: **Tavoli** (apre e chiude i tavoli, sblocca i codici), **Ordini** (accetta o rifiuta gli ordini da casa, «Segna partito/consegnato/ritirato», «Portate» per bevande e piatti pronti; mai i bottoni a cascata, che sono l'emergenza), **Menù** (segna un piatto esaurito) e **Nuovo ordine** (2 ordini presi al telefono e su WhatsApp).
- **Tablet del banco sushi** e **tablet della cucina**: ognuno vede solo le proprie comande e tocca «Inizia a preparare» e «Segna pronta».
- **Telefono del cameriere** (postazione Sala, 375 px): dal dettaglio del Tavolo 5 tocca «Ordina per il tavolo» e manda una tartare, un tiramisù e una birra.
- **6 tavoli** con 2–4 telefoni ciascuno (19 clienti), che ordinano a più riprese; i tavoli dispari chiudono col dolce, così molti ordini toccano banco e cucina insieme.
- **5 clienti dal sito** (3 asporto, 2 domicilio, uno rifiutato) e **2 ordini dalla cassa** (un asporto al telefono, un domicilio su WhatsApp, entrambi con una bevanda).

## Esito

**Superato: 41 ordini al tavolo (1 dal cameriere), 7 da casa (5 dal sito, 2 dalla cassa), 0 problemi, 0 richieste lente (oltre 2,5 s).** Durata della serata: 195 s.

Controlli sul database a fine serata:
- ogni ordine confermato al cliente è nel database, con lo stesso totale; nessun ordine doppio (una chiave d'invio per ordine);
- il totale di ogni ordine è uguale alla somma delle sue righe; il conto di ogni tavolo è uguale alla somma degli ordini confermati (Tavolo 5 compresa la comanda del cameriere: 206,00 €);
- tutti gli ordini al tavolo «servito», tutti quelli da casa «completato» o «rifiutato», tutti i tavoli chiusi;
- **comande:** per ogni ordine tante comande quanti i reparti delle righe (da casa senza la comanda delle bevande); ogni ordine servito o completato ha tutte le comande «pronta» o «annullata»; nessuna comanda ancora da fare; nessuna comanda di bevande rimasta da portare;
- **origine:** i 2 ordini della cassa hanno origine `cassa` e **nessuna email in coda**; quello del cameriere ha origine `cameriere`; tutti gli altri `cliente`.

### Tempi

Dall'invio dell'ordine al primo momento in cui compare sullo schermo (gli schermi si aggiornano ogni 5 secondi):

| Schermo | Ordini | Mediana | 95% entro | Massimo |
|---|---|---|---|---|
| Cassa | 43 | 1,0 s | 3,9 s | 5,2 s |
| Banco sushi | 40 | 1,3 s | 5,3 s | 44,3 s (vedi nota 1) |
| Cucina | 22 | 2,6 s | 4,9 s | 4,9 s |
| Cassa dopo 40 s di standby | 1 | 40,5 s | | (voluto: vedi sotto) |

Dalla nascita della comanda (registrati nel database):

| Reparto | Comande | Inizio: mediana / 95% | Pronta: mediana / 95% / massimo |
|---|---|---|---|
| Banco sushi | 40 | 3,0 s / 8,1 s | 5,2 s / 10,1 s / 45,2 s (nota 1) |
| Cucina | 22 | 3,3 s / 6,2 s | 4,1 s / 8,5 s / 8,6 s |
| Sala (bevande, fino a «Portate») | 13 | — | 6,5 s / 9,0 s / 9,0 s |

| Altro | Mediana | 95% entro | Massimo |
|---|---|---|---|
| Invio dal tavolo | 0,35 s | 0,43 s | 2,0 s |
| Invio dal telefono del cameriere | 0,7 s | | |
| Invio dal sito | 0,15 s | 0,26 s | 0,26 s |
| Invio dalla cassa | 0,24 s | | |
| Ingresso al tavolo col codice | 0,6 s | 1,1 s | 1,1 s |

I tempi di preparazione sono quelli di una cucina simulata che tocca un bottone ogni 0,3–0,9 s: dicono che il percorso funziona e quanto aspetta una comanda per comparire, non quanto ci mette un sushi chef. Sono misurati su un solo computer con il database finto: con Vercel e Supabase veri saranno un po' più alti.

1. Il massimo del banco è l'ordine a domicilio arrivato mentre il tablet della cassa era in standby: il banco vede gli ordini da casa **solo dopo l'accettazione**, e la cassa l'ha accettato al risveglio. È il comportamento voluto (al banco non arriva nulla che la cassa possa ancora rifiutare); il tempo della comanda parte dalla sua nascita, cioè dall'invio del cliente, e quindi comprende l'attesa dell'accettazione.

## Imprevisti provati

| Imprevisto | Cosa è successo |
|---|---|
| Doppio tocco su «Invia ordine» | Un solo ordine. |
| La risposta del server si perde dopo l'invio | «Non siamo sicuri che l'ordine sia arrivato. Riprova…»; al nuovo tentativo torna lo stesso ordine, nessun doppione. |
| Telefono senza rete all'invio | Stesso messaggio; tornata la rete, l'ordine parte una volta sola. |
| 5 codici sbagliati (Tavolo 3) | Il telefono viene bloccato; la cassa vede «5 codici sbagliati» sulla piastrella e sblocca dal dettaglio. Anche il vicino col codice giusto era bloccato (stessa rete: vedi sotto). |
| Edamame esaurito mentre è nel carrello | «Alcuni piatti non sono più disponibili: Edamame»; il resto parte al secondo invio. |
| Tavolo chiuso con un carrello ancora pieno (Tavolo 1) | L'ordine non passa; il telefono mostra «Il tavolo è chiuso, grazie per essere stati da noi!». |
| Tablet della cassa in standby per 40 s | Nascosto non si aggiorna (previsto); al risveglio il nuovo ordine compare in 0,3 s. |
| Ordine dal sito rifiutato | Il cliente vede «Rifiutato». |
| Accetta, +15’, +30’ | Le card di banco e cucina mostrano l'orario spostato (es. «Domicilio 14:30» diventa «Domicilio 14:45»); i clienti vedono l'avanzamento fino a «Ritirato» o «Consegnato». |
| Ordini dalla cassa con una bevanda | Banco e cucina ricevono solo la loro parte, nessuna comanda di bevande; la cassa li porta a «Ritirato» e «Consegnato». |
| Comanda del cameriere su un tavolo con i clienti che ordinano | Arriva al banco, in cucina e nella striscia delle bevande come le altre; «Ordinato finora» la mostra con «Dal cameriere»; il conto torna. |

## Problemi trovati

Nessuno nell'ultimo giro: 0 problemi nei controlli, 0 richieste oltre 2,5 s, 0 richieste fallite. Restano le osservazioni già note:

1. **Il limite dei tentativi per rete blocca anche i vicini di tavolo** (come nella serata del 14/10): sul Wi-Fi del locale i telefoni hanno lo stesso indirizzo, e dopo i 5 errori di un cliente anche chi scrive il codice giusto legge «Troppi tentativi…» finché il cameriere non preme «Sblocca».
2. **I bottoni a cascata della cassa** («Inizia a preparare», «Segna servito», «Segna pronto» sulla card intera) restano visibili: portano avanti tutte le comande dell'ordine insieme, anche quelle del banco e della cucina. Nella serata non si usano; in sala va detto che sono un'emergenza.
3. **Non provato qui**: suoni (Playwright non li sente), tre dispositivi diversi su una rete vera, stampa del conto, email (spente senza dominio), cambio di reparto di una categoria a serata in corso.

## Da provare in sala con Daniel

- **Postazioni reali.** Su ogni dispositivo «Inizia turno» con la postazione giusta: tablet alla cassa (Cassa), tablet al banco (Banco sushi), tablet in cucina (Cucina), telefoni dei due camerieri (Sala). Controllare che il cookie resti dopo uno spegnimento e che «Postazione…» cambi al volo. Chi vede cosa: il banco non deve vedere starter e dolci, la cucina non il sushi, nessuno dei due gli ordini da accettare.
- **Suoni.** Cassa: suono ogni 10 s finché c'è un ordine dal sito da accettare, tre bip per ogni voce nuova da portare. Banco e cucina: tre bip per comanda nuova. Si sentono al bancone col rumore della sala? E in cucina con le cappe accese? Il wake lock tiene acceso lo schermo dei tablet?
- **Wi-Fi.** Copertura in cucina (non a vista, il punto più lontano) e al bancone; cosa succede quando un tablet perde la rete per qualche secondo (lo schermo deve restare visibile con l'ora dell'ultimo aggiornamento e ripartire da solo).
- **Limite dei tentativi per IP.** Con tutti i telefoni sul Wi-Fi del locale, un cliente distratto blocca anche il tavolo: decidere con Daniel se alzare il limite per rete (lasciando quello per telefono a 5) o se basta lo «Sblocca» del cameriere.
- **Cassa al telefono.** Un ordine vero dettato al telefono e uno da WhatsApp con `/staff/nuovo-ordine`: tempi della ragazza alla cassa, se «Forza» su un orario pieno serve davvero, se l'occupazione «3/4» sotto gli orari si capisce.
- **Cameriere.** Un tavolo che non vuole usare il QR: il cameriere ordina dal suo telefono, la comanda arriva divisa tra banco e cucina, le bevande nella sua striscia «Da portare al tavolo».
- **«Da portare al tavolo».** Chi tocca «Portate»: la cassa, i camerieri o entrambi? Con due camerieri e la cassa sulla stessa striscia, il primo che tocca la chiude per tutti.
- **Le due scelte da confermare**: la cassa prende ordini anche con «Apri ordini di oggi» spento, e può forzare un orario pieno.
