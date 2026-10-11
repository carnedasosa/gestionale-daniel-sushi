import { etichettaAllergene } from '@/domain/allergeni'
import type { Piatto } from './repo'

export function testoAllergeni(p: Pick<Piatto, 'allergeni' | 'allergeniConfermati'>): string {
  if (!p.allergeniConfermati) return 'Allergeni in verifica: chiedi al personale prima di ordinare'
  if (p.allergeni.length === 0) return 'Nessuno dei 14 allergeni'
  return `Allergeni: ${p.allergeni.map(etichettaAllergene).join(', ')}`
}
