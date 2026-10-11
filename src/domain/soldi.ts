export type Centesimi = number

export function euroInCentesimi(euro: number): Centesimi {
  const cent = Math.round(euro * 100)
  if (!Number.isFinite(cent) || cent < 0) throw new RangeError(`Importo non valido: ${euro}`)
  return cent
}

// Accetta «10», «10,5», «10,50», «10.50», con «€» solo all'inizio o alla fine (spazi, anche indivisibili, ammessi).
// Niente migliaia né negativi.
const FORMATO_EURO = /^(\d{1,4})(?:[.,](\d{1,2}))?$/

export function parseEuro(testo: string): Centesimi | null {
  let pulito = testo.trim()
  if (pulito.startsWith('€')) pulito = pulito.slice(1).trim()
  else if (pulito.endsWith('€')) pulito = pulito.slice(0, -1).trim()
  const m = FORMATO_EURO.exec(pulito)
  if (!m) return null
  const interi = Number(m[1])
  const decimali = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  return interi * 100 + decimali
}

export function formatEuro(cent: Centesimi): string {
  const euro = Math.trunc(cent / 100)
  const resto = String(Math.abs(cent % 100)).padStart(2, '0')
  return `${euro},${resto}\u00a0€`
}
