# Serata simulata — 14/10/2026

Prova automatica di una serata intera sul **database finto** (mai su quello reale), con l'app compilata come in produzione. Si rilancia con `npm run serata` (circa 4 minuti, servono `E2E_EMAIL` ed `E2E_PASSWORD` in `.env.local`). Il registro dettagliato finisce in `test-results/serata/risultati.json`.

## Chi c'era

- **Tablet in sala**: apre e chiude i tavoli, sblocca i codici, segna un piatto esaurito.
- **Tablet in cucina**: accetta o rifiuta gli ordini da casa, porta avanti le comande fino a «servito», «ritirato» o «consegnato».
- **6 tavoli** con 2–4 telefoni ciascuno (21 clienti), che ordinano a più riprese, a volte con la poke composta.
- **5 clienti da casa** (3 asporto, 2 domicilio), che seguono l'ordine dalla pagina di stato.

## Esito dell'ultimo giro

**Superato: 45 ordini al tavolo, 5 da casa, 0 problemi.**

Controlli fatti sul database a fine serata:
- ogni ordine confermato al cliente è nel database, con lo stesso totale;
- nessun ordine doppio;
- il totale di ogni ordine è uguale alla somma delle sue righe;
- il conto di ogni tavolo è uguale alla somma degli ordini confermati ai clienti;
- tutte le comande sono state servite e tutti i tavoli chiusi.

| Tempo misurato | Mediana | 95% entro | Massimo |
|---|---|---|---|
| Invio dell'ordine dal tavolo | 0,3 s | 0,4 s | 2,1 s |
| Arrivo della comanda sullo schermo della cucina | 0,7 s | 3,2 s | vedi nota |
| Ingresso al tavolo col codice | 0,4 s | 0,7 s | 0,8 s |
| Invio dell'ordine da casa | 0,1 s | 0,2 s | 0,2 s |

Nota: due ordini sono arrivati in cucina dopo circa 40 secondi. È voluto: il tablet era in standby per la prova qui sotto.

I tempi sono misurati su un solo computer con il database finto: con Vercel e Supabase veri saranno un po' più alti, perché passano da internet.

## Imprevisti provati

| Imprevisto | Cosa è successo |
|---|---|
| Doppio tocco su «Invia ordine» | Un solo ordine. |
| La risposta del server si perde dopo l'invio | Il telefono dice «Non siamo sicuri che l'ordine sia arrivato. Riprova…»; al nuovo tentativo torna lo stesso ordine, nessun doppione. |
| Telefono senza rete al momento dell'invio | Stesso messaggio; tornata la rete, l'ordine parte una volta sola. |
| 5 codici sbagliati | Il telefono viene bloccato; sulla piastrella del tavolo la sala vede «5 codici sbagliati», nel dettaglio preme «Sblocca» e il cliente entra. |
| Piatto esaurito mentre è nel carrello | Il server rifiuta: «Alcuni piatti non sono più disponibili: Edamame», toglie il piatto dal carrello e il resto parte al secondo invio. |
| Tavolo chiuso con un cliente che ha ancora il carrello pieno | L'ordine non passa; il telefono mostra «Il tavolo è chiuso, grazie per essere stati da noi!». |
| Sala che chiude un tavolo con comande ancora in cucina | L'app avvisa «Ci sono N ordini ancora in cucina: chiudere comunque?». |
| Tablet della cucina in standby per 40 s | Mentre è nascosto non si aggiorna (previsto); al risveglio il nuovo ordine compare in 0,2 s. |
| Ordine da casa rifiutato | Il cliente vede «Rifiutato» sulla pagina dell'ordine. |
| Ordini da casa accettati (+0, +15, +30 minuti) | I clienti vedono l'avanzamento fino a «Ritirato» o «Consegnato». |

## Da sapere

1. **Un cliente che sbaglia il codice 5 volte blocca anche chi è seduto con lui.** Il limite conta i tentativi per telefono e anche per rete: chi è sul Wi-Fi del locale ha lo stesso indirizzo. Nella prova il cliente A ha scritto il codice giusto subito dopo i 5 errori di B ed è stato bloccato anche lui, con il messaggio «Troppi tentativi…». Basta che il cameriere prema «Sblocca». Gli altri tavoli non sono toccati. Si può alzare il limite per rete lasciando quello per telefono a 5: è una scelta da fare dopo la prova in sala.
2. **Una volta, lo schermo della cucina è rimasto fermo circa 30 secondi** dopo «Accetta +15’» su un ordine da casa: pulsanti disattivati e nessuna comanda nuova. È successo in 1 serata su 5 complete. Non si è ripetuto in una prova mirata con 16 tocchi durante aggiornamenti rallentati di proposito. La durata coincide con il «riprova comunque dopo 30 secondi» dell'aggiornamento automatico, che quindi ha sbloccato da solo lo schermo. Da tenere d'occhio nella prova in sala.
3. **Lo schermo staff tiene il tablet acceso** («Attiva suono e schermo sempre acceso», con il wake lock del browser). Se però qualcuno passa a un'altra app, lo schermo smette di aggiornarsi e non suona finché non si torna sul gestionale.
4. **Non provato qui**: capacità della cucina piena (con 5 ordini da casa nessun orario si è riempito), email (spente senza dominio), stampa del conto.
