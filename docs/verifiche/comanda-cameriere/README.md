# Comanda del cameriere — 16/10/2026

Verifica della tappa 2 del piano «il locale»: lo staff, loggato sul proprio telefono, ordina per un tavolo aperto senza codice del cliente.

Prova end-to-end `e2e/tavolo.spec.ts` sul database finto (mai su quello reale), con l'app compilata come in produzione: dopo gli ordini di Anna e Bruno lo staff apre il dettaglio del tavolo → «Ordina per il tavolo», aggiunge una tartare e invia; il telefono di Anna mostra la comanda con il chip «Dal cameriere»; la cucina la serve; il conto chiude a 21,00 €.

Schermate a 375 px, prese dal test con `E2E_SCHERMATE=<cartella> npx playwright test e2e/tavolo.spec.ts`:

- `comanda-cameriere-375-testa.png`: intestazione «Ordine per Tavolo prova · codice», conferma dell'invio, barra del carrello.
- `comanda-cameriere-375-ordinato.png`: «Ordinato finora» con il chip «Dal cameriere» e il totale del tavolo.
