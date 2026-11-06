import { createHash } from 'node:crypto'

export const LIMITE_EMAIL = 10
export const LIMITE_RETE_ACCESSO = 30
export const FINESTRA_ACCESSO_MINUTI = 15
export interface ErroriAccesso { email: number; rete: number }

// La rete ha un limite più alto dell'email perché sul Wi-Fi del locale tutti i dispositivi escono dallo stesso indirizzo.
export function accessoBloccato(e: ErroriAccesso): boolean {
  return e.email >= LIMITE_EMAIL || e.rete >= LIMITE_RETE_ACCESSO
}

// Nel database non finisce l'email ma la sua impronta: per contare basta, e nel campo può finire di tutto
// (una password scritta nel posto sbagliato, la mail di chi non è del personale). Maiuscole e spazi non cambiano
// il conteggio, perché per Supabase l'account è lo stesso.
export function chiaveEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

// Contano solo i rifiuti di Supabase. Un guasto suo (5xx, rete: stato 0 o assente) o il suo limite di richieste (429)
// non dicono nulla sulla password: contarli bloccherebbe il personale proprio quando Supabase ha un problema.
export function erroreDiCredenziali(errore: { status?: number } | null | undefined): boolean {
  const stato = errore?.status
  return stato !== undefined && stato >= 400 && stato < 500 && stato !== 429
}
