export const ALLERGENI = [
  { codice: 'glutine', etichetta: 'Cereali contenenti glutine' },
  { codice: 'crostacei', etichetta: 'Crostacei' },
  { codice: 'uova', etichetta: 'Uova' },
  { codice: 'pesce', etichetta: 'Pesce' },
  { codice: 'arachidi', etichetta: 'Arachidi' },
  { codice: 'soia', etichetta: 'Soia' },
  { codice: 'latte', etichetta: 'Latte' },
  { codice: 'frutta_a_guscio', etichetta: 'Frutta a guscio' },
  { codice: 'sedano', etichetta: 'Sedano' },
  { codice: 'senape', etichetta: 'Senape' },
  { codice: 'sesamo', etichetta: 'Semi di sesamo' },
  { codice: 'solfiti', etichetta: 'Anidride solforosa e solfiti' },
  { codice: 'lupini', etichetta: 'Lupini' },
  { codice: 'molluschi', etichetta: 'Molluschi' },
] as const

export type CodiceAllergene = (typeof ALLERGENI)[number]['codice']

const CODICI: readonly string[] = ALLERGENI.map((a) => a.codice)

export function eAllergene(x: string): x is CodiceAllergene {
  return CODICI.includes(x)
}

export function etichettaAllergene(c: CodiceAllergene): string {
  return ALLERGENI.find((a) => a.codice === c)!.etichetta
}

export function normalizzaAllergeni(codici: readonly string[]): CodiceAllergene[] {
  for (const c of codici) if (!eAllergene(c)) throw new Error(`Allergene sconosciuto: ${c}`)
  return ALLERGENI.map((a) => a.codice).filter((c) => codici.includes(c))
}
