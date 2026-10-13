import type { CategoriaConPiatti } from '@/menu/repo'
import { SezioniMenu } from '@/ordinare/SezioniMenu'

/** Menù da consultare (ordini da casa chiusi): stessi piatti, nessun bottone. */
export function MenuCliente({ categorie }: { categorie: CategoriaConPiatti[] }) {
  return <SezioniMenu categorie={categorie} />
}
