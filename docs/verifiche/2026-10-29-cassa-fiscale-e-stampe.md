# Verifica: cassa, fiscale e stampe

Data: 2026-10-29 · Branch `cassa-fiscale-stampe` · Spec: [`2026-10-29-cassa-fiscale-e-stampe-design.md`](../superpowers/specs/2026-10-29-cassa-fiscale-e-stampe-design.md)

## Che cosa è stato provato

| Area | Dove | Che cosa garantisce |
|---|---|---|
| Divisione del conto | `src/domain/divisione-conto.test.ts`, `src/cassa/pagamenti-repo.test.ts` | Alla romana: quote che sommano **esattamente** il totale (anche 100,01 € in 3), differenza massima 1 centesimo, pagando una quota alla volta sul residuo si arriva a zero. Per piatti: una porzione di una voce da tre, coperti, niente porzioni o coperti pagati due volte; due persone che si dividono tutto pagano esattamente il conto. Importo oltre il residuo rifiutato, incasso tolto che torna nel residuo, incasso a tavolo chiuso, residuo negativo dopo un annullo. |
| Coperti | `src/tavoli/coperti.test.ts` | Il coperto entra nel conto e nel riepilogo del tavolo con lo stesso totale; il prezzo si fissa la prima volta; vincoli nel DB. |
| Calcolo fiscale | `src/fiscale/documento.test.ts`, `src/fiscale/scontrini-repo.test.ts` | Righe dello scontrino sempre uguali al pagamento. Conto intero: piatto per piatto, coperto e reparti fiscali. Romana con due aliquote: ogni scontrino torna con la sua quota e i reparti sono in proporzione (resti maggiori, errore < 1 centesimo). Per piatti + saldo: righe vere anche per il residuo. Asporto: righe dell'ordine. XML Epson esatto (escape, importi, paymentType/index) e lettura della risposta (numero, data, Z; rifiuto col codice; illeggibile). |
| Esiti dell'RT | `src/fiscale/scontrini-repo.test.ts` | Mai due scontrini: emesso → non si richiede né si toglie; rifiutato o connessione mai partita → si può rimandare; senza risposta → «incerto», non riparte da solo, lo risolve la cassa; lavoro fiscale scaduto → incerto anche sul pagamento; ponte in prova → «di prova». |
| Instradamento delle stampe | `src/stampa/formato.test.ts`, `src/stampa/stampe-repo.test.ts` | Banco e cucina alla loro stampante, bevande alla cassa solo se richiesto, pre-conto alla cassa, scontrino solo all'RT. Nessuna stampa con i reparti a schermo (come oggi). Da casa: dal sito all'accettazione con la fascia spostata, dalla cassa subito. Annulli: biglietto in coda corretto o tolto, già stampato → ANNULLATO solo con le righe tolte (riga, voce del conto su più ordini, ordine intero). Presa atomica (un lavoro una volta sola), scadenza → di nuovo in coda, 5 tentativi poi errore, ristampa. |
| Stati con la carta | `src/stampa/stampe-repo.test.ts` | Comanda stampata → in preparazione, «Da portare» con «Portate» → pronta e portata, ordine servito; chiusura del tavolo senza conferma per le comande già stampate. |
| Formato ESC/POS | `src/stampa/formato.test.ts` | Reset e tabella PC858, accentate ed euro, niente byte di controllo dal testo, grassetto/grande, taglio; biglietti dentro gli 80 mm (48 colonne, 24 in grande); rientri di note e poke. |
| Ponte di stampa | `scripts/ponte-stampa/trasporto.test.ts` | Byte veri su una porta TCP locale, stampante spenta → esito non riuscito, RT con risposta / HTTP in errore (incerto) / connessione rifiutata (certo) / tempo scaduto (incerto), modalità prova su file, giro completo con token. |
| API del ponte | `src/app/api/stampa/stampa.test.ts` | 503 senza token configurato, 401 con token sbagliato o corto, mai in cache, corpo dell'esito controllato. |
| Foto e vini | `src/menu/foto-repo.test.ts`, `src/domain/foto.test.ts`, `src/app/foto/…/route.test.ts`, `src/menu/vini-repo.test.ts`, `src/menu/componenti/CartaVini.test.tsx` | Solo JPEG/PNG/WebP dai byte fino a 400 KB, versione nuova a ogni foto, cache di un anno; carta dei vini per tipologia, vuota nascosta, piatti nuovi con numero unico. |
| Azioni (server) | `*.test.ts` accanto alle azioni | `richiediRuolo` prima di ogni accesso ai dati, validazione, messaggi in italiano. |
| End-to-end | `e2e/cassa-fiscale.spec.ts` | Sulla build di produzione con il **ponte vero in modalità prova**: coperti dal dettaglio del tavolo, ordine dal QR, due biglietti (banco, cucina) usciti dal ponte, «Portate», conto 17,00 € con coperto, pre-conto «8,50 € a testa», romana in due (contanti e carta) con scontrino, XML all'RT, tavolo chiuso senza domande, vino nuovo nella carta dei vini del menù pubblico. |

## Esito

Vedi la sezione «Risultati» in fondo (comandi e numeri reali dell'ultima esecuzione).

## Che cosa resta da provare nel locale

- **Registratore telematico vero**: il driver segue il protocollo Epson `fpmate.cgi` del driver aperto OCA, ma va provato sull'RT di Daniele (marca e modello da chiedere): uno scontrino da 0,01 € di prova, poi un pagamento con carta per l'indice del pagamento elettronico.
- **Stampanti delle comande**: ESC/POS su porta 9100 (Epson TM-T20/m30 e compatibili); da provare carta, taglio e accentate sulle stampanti scelte.
- **Ponte**: acceso sul PC della cassa con `STAMPA_TOKEN` (da mettere anche su Vercel), con la rete del locale.
- **Migrazioni** (sei, tutte additive) da applicare al DB reale prima del merge.
