// I cookie della sessione li leggono e li scrivono solo il server e il proxy (l'app non usa mai createBrowserClient):
// con httpOnly una XSS non può rubare access e refresh token. `secure` come negli altri cookie (src/tavoli/cookie.ts):
// la build di produzione lo mette anche sugli e2e in http://127.0.0.1, che il browser tratta come origine sicura.
// Niente `name` né `maxAge`: il primo cambierebbe il nome del cookie e farebbe uscire tutti, il secondo lo decide la libreria.
export function opzioniCookieSessione() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const }
}
