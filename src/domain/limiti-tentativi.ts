export const LIMITE_DISPOSITIVO = 5
export const LIMITE_SESSIONE = 30
export const FINESTRA_MINUTI = 10
export interface ErroriCodice { dispositivo: number; ip: number; sessione: number }
export function bloccato(e: ErroriCodice): boolean {
  return e.dispositivo >= LIMITE_DISPOSITIVO || e.ip >= LIMITE_DISPOSITIVO || (e.sessione >= LIMITE_SESSIONE && (e.dispositivo > 0 || e.ip > 0))
}
