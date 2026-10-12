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

La prova reale aveva rilevato risultati misassociati tra letture parallele attraverso il transaction pooler (una query sui conti riceveva colonne di un'altra lettura), con postgres.js che accoda più query sulla stessa connessione. La prima correzione con `reserve()`/`release()` introduceva però un guasto peggiore (revisione PR #3, N1): dopo una caduta della connessione postgres@3.4.9 rimette in uso una connessione morta. Con un server Postgres finto è emerso che anche `sql.begin` lascia inutilizzabile la connessione se cade durante una transazione. Il driver è stato quindi sostituito con `pg` 8.23.0: una query per connessione alla volta, connessioni rotte scartate dal pool, ascoltatori `error` sul pool e sulla connessione in transazione. I test in `src/server/db.integrazione.test.ts` (server finto in `tests/server/postgres-finto.ts`) coprono caduta durante lettura e transazione, rollback, assenza di pipelining e caduta di una connessione inattiva.

Se `poke_config` viene salvata in una forma non valida, `/admin/poke` mostra «Configurazione della poke non trovata» e la poke composta non è ordinabile: si corregge solo via SQL, ripristinando `gruppi` come array JSON di gruppi. La migrazione della tappa 1 è stata rinominata in `20261011163506_menu_e_ruoli.sql`, la versione registrata sul progetto Supabase.

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
## Correzioni dopo la revisione della PR #3

Eseguite il 12 ottobre 2026 su `correzioni-tappa-2`, dopo il fast-forward autorizzato da `5abb0c3` a `f1d9c6f`. Rispetto a `51d2749` cambiava soltanto il piano. `hig-restyle` è rimasto a `f1d9c6f`: nessun commit di merge, nessun force push e nessuna modifica a quel branch.

- **N1** — Driver `pg@8.23.0`, pool e connessioni rotte gestiti in `src/server/db-adapter.ts` e `src/server/db.ts`; test reali del protocollo con server finto in `src/server/db.integrazione.test.ts` e `tests/server/postgres-finto.ts`. Sostituisce la soluzione precedente con connessione riservata. Nessuna opzione TLS aggiunta.
- **N2** — `src/app/staff/page.tsx`, `InizioTurno.tsx`, `SchermoStaff.tsx` e `src/domain/arrivi-cucina.ts`: cucina sempre montata con ultimi dati, audio condiviso e arrivi conservati nella scheda; anche gli errori della lettura del ruolo mantengono lo schermo, mentre i redirect Next propagano.
- **N3** — `src/app/staff/ChiusuraConto.tsx`, `conto/[sessione]/page.tsx` e `src/tavoli/ordini-repo.ts`: riferimento iniziale del conto conservato fino al ricontrollo esplicito, avviso e conferma sui nuovi ordini.
- **N4** — `src/domain/ip-client.ts`, `limiti-tentativi.ts` e `src/tavoli/repo.ts`: IPv6 raggruppato per rete /64 e limite di 30 errori per tutti i nuovi accessi alla sessione.
- **Minor 2** — `src/domain/ip-client.ts` e `src/tavoli/repo.ts`: indirizzo assente o non valido restituisce null, senza contatore condiviso «sconosciuto».
- **Minor 3** — `src/app/tavolo/[chiave]/page.tsx` e `ModuloCodice.tsx`: nessun saluto di tavolo chiuso quando il tavolo è stato riaperto.
- **Minor 5** — `src/app/admin/tavoli/ModuloTavolo.tsx`: la conferma di rigenerazione QR avverte anche i clienti già seduti.
- **Minor 9** — `src/componenti/AggiornamentoAutomatico.tsx` e `src/domain/connessione.ts`: una transizione in corso impedisce altri refresh, con nuovo tentativo dopo 30 secondi.
- **Minor 10** — `src/domain/origine-app.ts` e `src/app/admin/tavoli/page.tsx`: protocolli inoltrati diversi da HTTP/HTTPS ignorati; APP_URL non valido nasconde i link senza impedire la gestione dei tavoli. Stampa QR invariata.
- **Minor 11** — nota operativa sulla configurazione poke non valida nella sezione Supabase reale di questo README; prima migrazione rinominata in `20261011163506_menu_e_ruoli.sql` con contenuto identico, senza eseguire migrazioni sul DB.
- **Minor 12** — `src/app/tavolo/[chiave]/Carrello.tsx`: una poke da ricomporre mostra «—» e il totale dichiara di escluderla.

### Comandi e risultati

- `npm ci` e `npm test` sulla base: 39 file, 173 test passati.
- Test rossi eseguiti prima delle implementazioni di driver, arrivi cucina, blocco refresh, riferimento conto e limiti: falliti per le funzionalità mancanti previste.
- `npx vitest run src/server`: 7 test passati, senza errori non gestiti; suite del Task 1: 40 file, 177 test.
- Task 2: 14 test mirati; Task 3: 3; Task 4: 28; Task 5: 83. Tutti verdi, con typecheck ed ESLint a fine task.
- Verifica finale Task 6: `npm test` → **41 file, 192 test passati**; `npm run typecheck`, `npm run lint`, `npm run build` tutti passati senza flag aggiuntivi. Build ripetuta prima della prova di produzione locale con `npm run start`.
- `npx tsx --env-file=.env.local scripts/verifica-poke-postgres.ts`, dopo consenso: round-trip JSON e prezzi verificati nella sola tabella temporanea; nessun dato persistente modificato.
- Il `git grep` globale richiesto trova esempi storici nei piani Markdown; la stessa ricerca su `src`, `scripts` e `tests` non trova import del vecchio driver né `adattaSql`. I vecchi documenti sono conservati.
- `npm ci` segnala cinque vulnerabilità high e una deprecazione ESLint già sulla base; nessun aggiornamento fuori dalle due dipendenze consentite dal piano.

### Prova locale con Supabase reale

Login inserito personalmente dall’utente nel browser integrato. Cliente in un browser Chrome separato senza cookie di login staff/admin, verificato dal reindirizzamento di `/staff` al login; questo isolamento sostituisce la finestra incognito prevista dal piano. Nessun prezzo poke modificato durante questa prova.

1. **Nuovo ordine e suono:** aperta una nuova sessione di Tavolo 1; ordine n. 8, Edamame da 3 €, comparso con «Nuovo ordine». Audio attivo e avvisi udibili confermati dall’utente: «Sì, ho sentito gli avvisi».
2. **Navigazione conto/cucina:** nessun «Riattiva suono» al ritorno. Ordine n. 9, Alga wakame da 4 €, inviato mentre lo staff era sul conto e riconosciuto come nuovo al ritorno.
3. **Conto aggiornato dopo oltre 15 secondi:** aperto a 7 €, poi ordine n. 10, Gamberi in tempura da 3 €. Dopo un’attesa esplicita di 16 secondi e i refresh automatici, avviso «È arrivato 1 nuovo ordine» con 7 € → 10 €; la chiusura chiede conferma per l’ordine arrivato dopo il conto. «Ho ricontrollato il conto» rimuove l’avviso.
4. **DB irraggiungibile e recupero:** fermato il server normale e riavviato con DATABASE_URL fittizia solo in quel processo. Banner «Database non raggiungibile… Lo schermo mostra gli ultimi dati ricevuti», tre comande e tavoli conservati, nessun «Riattiva suono». Terminato quel processo, rimossa la variabile di processo e riavviato normalmente: banner scomparso e dati ripresi senza ricaricare la pagina staff. `.env.local` e Supabase non modificati dalla simulazione.
5. **Vecchio cookie e riapertura:** il cliente è stato portato temporaneamente alla pagina di accesso per impedire che il polling ripulisse il cookie durante la chiusura. Chiusa la prima sessione della prova e aperta una seconda, il caricamento della pagina tavolo con il cookie precedente mostra il form codice senza «Il tavolo è chiuso». Anche la seconda sessione è stata chiusa.

Durante la preparazione di una scheda di appoggio, Chrome su `/` ha mostrato una vecchia pagina di Vino Passport; non è stata usata per la prova. I percorsi di login, tavolo e staff hanno mostrato il gestionale corretto. Nessuna modifica a cache o service worker del browser, fuori dal piano.

### Stato iniziale diverso dal piano e pulizia

La lettura reale prima della prova mostrava sei sessioni, due aperte, tre ordini preesistenti e undici righe. Con ulteriore consenso esplicito è stata chiusa e conservata nello storico la sessione vuota preesistente di Tavolo 1; Tavolo 2 è rimasto aperto. I tre ordini preesistenti non sono stati usati per la prova.

Dopo aver mostrato il SQL e ricevuto il consenso separato sono stati eliminati **3 ordini della prova (n. 8–10), 3 righe per cascata, 2 nuove sessioni e 0 tentativi**. Verifica finale: tre ordini preesistenti e le loro undici righe identici al confronto prima/dopo, sei sessioni conservate, una aperta (Tavolo 2), zero tentativi, due tavoli e 139 piatti. Cucina vuota verificata nel browser. Sequenze, prezzi, tavoli, chiavi QR e schema non modificati dalla pulizia.

SQL effettivamente eseguito, con i soli identificativi dei dati temporanei già eliminati:

```sql
begin;
select id from public.sessioni_tavolo
where id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')
order by id for update;
do $verifica$
begin
  if (select count(*) from public.sessioni_tavolo
      where id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')
      and tavolo_id='a2e27a41-a2ef-457b-acd5-e55c636627c9' and chiusa_il is not null) <> 2 then
    raise exception 'Le sessioni di prova non corrispondono';
  end if;
  if (select count(*) from public.ordini
      where sessione_id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')) <> 3
     or (select count(*) from public.ordini
      where sessione_id='a80a9c9d-961a-4b5a-817a-d2c121ae457b'
      and id in ('436cebee-72fe-4a47-9721-4a7c0ec23bc7','259b5b4a-2db1-4af0-863e-0023162a97b6','2ff6e70c-a5d5-45ba-8420-587a1d85d893')) <> 3 then
    raise exception 'Gli ordini di prova non corrispondono';
  end if;
  if (select count(*) from public.righe_ordine
      where ordine_id in ('436cebee-72fe-4a47-9721-4a7c0ec23bc7','259b5b4a-2db1-4af0-863e-0023162a97b6','2ff6e70c-a5d5-45ba-8420-587a1d85d893')) <> 3 then
    raise exception 'Le righe di prova non corrispondono';
  end if;
  if (select count(*) from public.tentativi_codice
      where sessione_id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')) <> 0 then
    raise exception 'Sono comparsi nuovi tentativi da verificare';
  end if;
end;
$verifica$;
delete from public.ordini
where id in ('436cebee-72fe-4a47-9721-4a7c0ec23bc7','259b5b4a-2db1-4af0-863e-0023162a97b6','2ff6e70c-a5d5-45ba-8420-587a1d85d893')
returning id;
delete from public.tentativi_codice
where sessione_id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')
returning id;
delete from public.sessioni_tavolo
where id in ('a80a9c9d-961a-4b5a-817a-d2c121ae457b','9b15c667-d512-4fc2-872d-69b792fe0181')
returning id;
commit;
```
