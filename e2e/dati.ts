// Valori condivisi fra il database di prova, la configurazione di Playwright e i test.
export const PORTA_DB = 55432
export const PORTA_APP = 3100
export const URL_DB = `postgresql://postgres@127.0.0.1:${PORTA_DB}/postgres`
export const TAVOLO_E2E = { nome: 'Tavolo prova',slug: 'tavolo-prova',chiave: 'provae2e0001' }
