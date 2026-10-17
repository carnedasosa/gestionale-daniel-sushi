export const LIMITE_DISPOSITIVO = 5
export const LIMITE_RETE = 20
export const LIMITE_SESSIONE = 30
export const FINESTRA_MINUTI = 10
export interface ErroriCodice { dispositivo: number; ip: number; sessione: number }
// Sul Wi-Fi del locale tutti i telefoni escono con lo stesso indirizzo (la «rete» di ipDaHeaders:
// IPv4 o prefisso /64): con lo stesso limite del telefono, cinque errori di un cliente bloccherebbero
// tutta la sala. Il limite per telefono resta basso; quello per rete è più alto e ferma chi cambia
// dispositivo o cookie restando sulla stessa rete. Oltre LIMITE_SESSIONE errori sulla sessione si
// blocca chiunque non sia già entrato, anche un dispositivo o una rete mai visti: chi ha il QR non
// può provare tutti i codici cambiando anche indirizzo.
// I clienti già seduti non passano di qui; il personale ha «Sblocca» e «Nuovo QR».
export function bloccato(e: ErroriCodice): boolean {
  return e.dispositivo >= LIMITE_DISPOSITIVO || e.ip >= LIMITE_RETE || e.sessione >= LIMITE_SESSIONE
}
