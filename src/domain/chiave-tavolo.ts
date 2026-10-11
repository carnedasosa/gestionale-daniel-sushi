import { randomBytes } from 'node:crypto'
export function generaChiaveTavolo(rand: (n: number) => Uint8Array = randomBytes): string {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let chiave = ''
  while (chiave.length < 12) {
    for (const b of rand(16)) {
      if (b < 252) chiave += alfabeto[b % 36]
      if (chiave.length === 12) break
    }
  }
  return chiave
}
