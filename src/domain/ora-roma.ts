// Date e ore del locale: sempre nel fuso di Roma, anche se il server gira in UTC.
const FORMATO = new Intl.DateTimeFormat('en-GB',{ timeZone: 'Europe/Rome',hourCycle: 'h23',year: 'numeric',month: '2-digit',day: '2-digit',hour: '2-digit',minute: '2-digit',second: '2-digit' })
export interface PartiRoma { anno: number; mese: number; giorno: number; ore: number; minuti: number }
export function partiRoma(istante: Date): PartiRoma {
  const p = Object.fromEntries(FORMATO.formatToParts(istante).map(x => [x.type,x.value]))
  return { anno: +p.year,mese: +p.month,giorno: +p.day,ore: +p.hour,minuti: +p.minute }
}
const due = (n: number) => String(n).padStart(2,'0')
/** Data di Roma nel formato `AAAA-MM-GG`. */
export function dataRoma(istante: Date): string {
  const p = partiRoma(istante)
  return `${p.anno}-${due(p.mese)}-${due(p.giorno)}`
}
/** Ora di Roma nel formato `HH:MM`. */
export function oraRoma(istante: Date): string {
  const p = partiRoma(istante)
  return `${due(p.ore)}:${due(p.minuti)}`
}
export function dataValida(data: unknown): data is string {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [a,m,g] = data.split('-').map(Number), d = new Date(Date.UTC(a,m - 1,g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g
}
/** Giorno della settimana di una data `AAAA-MM-GG`: 1 = lunedì … 7 = domenica. */
export function giornoSettimana(data: string): number {
  const [a,m,g] = data.split('-').map(Number)
  return new Date(Date.UTC(a,m - 1,g)).getUTCDay() || 7
}
// Differenza in millisecondi tra l'ora di Roma e l'UTC in quell'istante (+1 h d'inverno, +2 h d'estate).
function scarto(istante: Date): number {
  const p = partiRoma(istante)
  return Date.UTC(p.anno,p.mese - 1,p.giorno,p.ore,p.minuti) - Math.floor(istante.getTime() / 60000) * 60000
}
/** L'istante in cui a Roma sono le `minuti` (dalla mezzanotte) del giorno `data`. */
export function istanteRoma(data: string, minuti: number): Date {
  const [a,m,g] = data.split('-').map(Number)
  const comeUtc = Date.UTC(a,m - 1,g) + minuti * 60000
  // Il secondo passaggio corregge lo scarto nei giorni del cambio d'ora.
  const primo = comeUtc - scarto(new Date(comeUtc))
  return new Date(comeUtc - scarto(new Date(primo)))
}
