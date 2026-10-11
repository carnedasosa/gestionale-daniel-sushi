export const LIMITE_DISPOSITIVO = 5
export const LIMITE_TAVOLO = 30
export const FINESTRA_MINUTI = 10
export function bloccato(erroriDispositivo: number, erroriTavolo: number): boolean {
  return erroriDispositivo >= LIMITE_DISPOSITIVO || erroriTavolo >= LIMITE_TAVOLO
}
