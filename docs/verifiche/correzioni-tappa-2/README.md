# Verifica delle correzioni della tappa 2

Eseguita l'11 ottobre 2026 sul branch `correzioni-tappa-2`, seguendo il piano datato 12 ottobre. Nessun deploy e nessuna modifica alle versioni delle dipendenze.

## Controlli locali

173 test in 39 file, typecheck, ESLint e build Next passati senza flag aggiuntivi. La build è stata eseguita senza `.env.local`, ripristinato al termine. I controlli completi sono stati eseguiti a fine di ogni task. Le guide Next incluse nella versione installata sono state consultate prima delle modifiche.

PGlite verifica schema, vincoli, transazioni e comportamenti sequenziali: non dimostra la concorrenza reale delle transazioni PostgreSQL. L'idempotenza reale si basa sull'indice unico della chiave d'invio e sui lock della sessione.

## Punti chiusi

| Punti | Comportamento verificato |
| --- | --- |
| I1, I2 | Chiusura con conferma esplicita se restano ordini in cucina; apertura del conto; comanda ancora visibile con «Tavolo chiuso»; conti recenti raggiungibili. |
| I3 | Stesso carrello e stessa chiave d'invio restituiscono lo stesso ordine, anche dopo una risposta persa. |
| I4 | Chiavi QR casuali uniformi di 12 caratteri su 36 simboli, circa 62 bit; limiti per sessione, dispositivo e IP; sblocco staff. |
| I5 | Preflight `/stato`, banner con ultimo aggiornamento, dati conservati durante la caduta, ripresa automatica; gestione degli errori DB e retry. |
| M1–M5 | Annullamento atomico e totale ricalcolato; ultimo articolo annullato chiude l'ordine; conteggio esclude annullati; poke diverse restano distinte; conto aperto aggiornato automaticamente. |
| M6–M9 | Ordini iniziali senza allarme, azione inutilizzata rimossa, conferma d'invio temporanea, avviso `APP_URL` e HTTP locale nella stampa QR. |
| M10–M12 | Test PGlite descritti come sequenziali; limite verificato attraverso il repo reale; query mirata sotto lock. |
| M13–M15 | Cookie legato al tavolo e ripulito tramite azione; poke nel carrello rivalidata; configurazione malformata restituisce `null` e non monta il compositore. |

Il backfill SQL usa campionamento uniforme su 36 simboli: le 12 cifre esadecimali dell'esempio del piano avrebbero fornito soltanto 48 bit, inferiori al requisito di almeno 60.

## Supabase reale

La migrazione `20261012180000_correzioni_tavolo.sql` è stata applicata a `daniel-sushi` dopo consenso esplicito, registrandola nella cronologia delle migrazioni. Prima della prova: 2 tavoli, una sessione già **chiusa**, nessun ordine, 139 piatti, cinque gruppi poke validi e prezzi poke null. Non è quindi servito chiudere una sessione preesistente.

Le cinque tabelle della tappa 2 mantengono RLS attivo, nessuna policy e nessun privilegio per `anon`/`authenticated`. L'advisor aggiornato mostra zero errori, nove informazioni «RLS Enabled No Policy» e un avviso Auth preesistente «Leaked Password Protection Disabled». Le impostazioni Auth non sono state modificate.

La prova reale ha rilevato risultati misassociati tra letture parallele attraverso il transaction pooler: una query sui conti riceveva colonne appartenenti a un'altra lettura. `db.query` ora riserva una connessione per ciascuna lettura e la restituisce anche in caso di errore. Rimangono cinque connessioni parallele e le transazioni con `begin`. Verifica reale successiva: 80 letture parallele con risultati corretti e una transazione `SELECT 1`; tre test proteggono isolamento, rilascio e uso di `begin`.

## Prova nel browser

Build di produzione locale con database reale; login amministratore già eseguito dall'utente. Il cliente usa Chrome senza cookie di login amministratore/staff, verificato dal reindirizzamento di `/staff` all'accesso.

1. «Nuovo QR» cambia l'URL; vecchia chiave e vecchio slug restituiscono 404. Stampa QR con avviso `APP_URL` assente e origine HTTP locale.
2. Cinque codici errati bloccano anche il codice corretto. «Sblocca» permette l'accesso. Una nuova sessione riparte con zero tentativi.
3. Un proxy locale temporaneo inoltra l'invio al server, attende la risposta HTTP 200 e interrompe la risposta verso il browser. Compare il messaggio sull'esito incerto. Il nuovo tentativo restituisce l'ordine n. 3: SQL conferma un solo ordine con quella chiave; il carrello si svuota.
4. Ordine n. 3 in preparazione. Chiusura: avviso di un ordine ancora in cucina, conferma esplicita e apertura del conto. La comanda rimane in cucina con «Tavolo chiuso» e il conto compare tra quelli recenti.
5. Ordine n. 4 con due poke diverse, poi servito. Il conto distingue salmone e tonno. Annullando la voce salmone già servita, rimane il tonno e il totale passa da 21 € a 12 €.
6. Il proxy restituisce temporaneamente 503 anche a `/stato`: compare il banner con l'ora dell'ultimo aggiornamento; restano cucina e conti, senza pagina di errore del browser. Ripristinando l'inoltro normale il banner scompare automaticamente. Questa prova usa un'interruzione controllata della raggiungibilità del server, anziché l'emulazione DevTools.

Il proxy e la pagina contenitore per le misure mobile sono strumenti temporanei esterni al repository; nessuna route di test è stata aggiunta all'applicazione.

## Responsive

Il controllo viewport del browser non applicava le dimensioni richieste: per misure effettive è stato usato un iframe dello stesso sito largo 375 px. Larghezza interna misurata 375 px, CSS caricato e larghezza del documento non superiore al viewport:

| Pagina | Larghezza documento | Fogli CSS |
| --- | ---: | ---: |
| Admin tavoli | 360 px | 2 |
| Stampa QR | 360 px | 2 |
| Configurazione poke | 360 px | 2 |
| Menù cliente | 360 px | 3 |
| Form codice cliente | 375 px | 3 |
| Schermo staff | 375 px | 2 |
| Conto chiuso e corretto | 360 px | 2 |

La differenza di 15 px è lo spazio della scrollbar verticale, non overflow orizzontale. Questa verifica non sostituisce una prova su telefono fisico.

## Dati di prova e consegna

Prezzi poke temporanei: base 9 €, extra 1 €. Dopo consenso separato sono stati eliminati soltanto i dati creati dalla prova: due sessioni di Tavolo 1, due ordini con tre righe e un tentativo rimasto dopo lo sblocco. Prezzi poke ripristinati a null. Controllo SQL finale: zero ordini, righe e tentativi; due tavoli con chiavi valide, una sessione storica chiusa conservata e 139 piatti. Lo schermo staff conferma cucina vuota e il solo conto storico precedente. Tavoli e nuove chiavi QR sono conservati.

Ultimo controllo completo: 173 test in 39 file, typecheck, lint e build senza `.env.local` passati l'11 ottobre alle 21:47. Successivamente sono stati aggiornati soltanto questo resoconto, le checkbox del piano e le immagini. Ripristinato il server di sviluppo su `localhost:3000` e terminati i proxy temporanei di prova.

Branch pubblicato e [PR #3](https://github.com/carnedasosa/gestionale-daniel-sushi/pull/3) aperta verso `main` con descrizione in italiano. Nessun merge o deploy eseguito.

Prima di stampare QR definitivi va configurato `APP_URL` con l'origine effettiva dell'applicazione. Con i prezzi poke originali null, la poke composta rimane indisponibile finché l'amministratore li imposta.

## Evidenze visive

- [Cucina con tavolo chiuso](cucina-tavolo-chiuso.png)
- [Conto con due poke distinte](conto-poke.png)
- [Conto corretto dopo annullamento](conto-corretto.png)
- [Connessione assente con dati conservati](connessione-assente.png)
- [Form cliente a 375 px](accesso-375.png)
- [Schermo staff dopo la pulizia](pulizia-completata.png)
