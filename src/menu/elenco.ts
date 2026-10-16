// Elenco dei piatti per admin e staff, con la ricerca istantanea.
import type { Reparto } from '@/domain/reparti'
export interface PiattoElenco { id: string; numero: number | null; nome: string; prezzoCent: number; allergeniConfermati: boolean; disponibile: boolean }
// `reparto` serve solo all'admin, che lo può cambiare.
export interface CategoriaElenco { id: string; nome: string; pezzi: string | null; reparto?: Reparto; piatti: PiattoElenco[] }
const semplice = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()
/** Piatti che corrispondono alla ricerca: per nome (senza accenti né maiuscole) o per numero esatto. */
export function filtraCategorie(categorie: CategoriaElenco[], testo: string): CategoriaElenco[] {
  const q = semplice(testo)
  if (!q) return categorie
  return categorie.map(c => ({ ...c,piatti: c.piatti.filter(p => /^\d+$/.test(q) ? p.numero === Number(q) : semplice(p.nome).includes(q)) })).filter(c => c.piatti.length)
}
