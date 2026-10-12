export const LIMITE_DISPOSITIVO = 5
export const LIMITE_SESSIONE = 30
export const FINESTRA_MINUTI = 10
export interface ErroriCodice { dispositivo: number; ip: number; sessione: number }
// Oltre LIMITE_SESSIONE errori sulla sessione si blocca chiunque non sia già entrato, anche un
// dispositivo o una rete mai visti: chi ha il QR non può provare tutti i codici cambiando indirizzo.
// I clienti già seduti non passano di qui; il personale ha «Sblocca» e «Nuovo QR».
export function bloccato(e: ErroriCodice): boolean {
  return e.dispositivo >= LIMITE_DISPOSITIVO || e.ip >= LIMITE_DISPOSITIVO || e.sessione >= LIMITE_SESSIONE
}
