import { randomInt } from 'node:crypto'

export function generaCodice(rand: (max: number) => number = randomInt): string {
  return Array.from({ length: 4 }, () => rand(10)).join('')
}
export function normalizzaCodice(input: string): string | null {
  if (typeof input !== 'string') return null
  const codice = input.replace(/\s/g, '')
  return /^\d{4}$/.test(codice) ? codice : null
}
