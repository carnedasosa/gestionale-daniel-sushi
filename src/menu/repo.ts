import type { Db } from '@/server/db-tipi'
import type { CodiceAllergene } from '@/domain/allergeni'

export interface Piatto {
  id: string
  categoriaId: string
  numero: number | null
  nome: string
  descrizione: string | null
  prezzoCent: number
  piccante: boolean
  vegetariano: boolean
  dellaCasa: boolean
  allergeni: CodiceAllergene[]
  allergeniConfermati: boolean
  disponibile: boolean
  posizione: number
}

export interface CategoriaConPiatti { id: string; nome: string; pezzi: string | null; posizione: number; piatti: Piatto[] }

export interface DatiPiatto {
  nome: string
  descrizione: string | null
  prezzoCent: number
  piccante: boolean
  vegetariano: boolean
  dellaCasa: boolean
  allergeni: CodiceAllergene[]
  allergeniConfermati: boolean
}

interface RigaPiatto {
  id: string; categoria_id: string; numero: number | null; nome: string; descrizione: string | null
  prezzo_cent: number; piccante: boolean; vegetariano: boolean; della_casa: boolean
  allergeni: CodiceAllergene[]; allergeni_confermati: boolean; disponibile: boolean; posizione: number
}

const COLONNE = `id, categoria_id, numero, nome, descrizione, prezzo_cent, piccante, vegetariano, della_casa,
  allergeni, allergeni_confermati, disponibile, posizione`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function daRiga(r: RigaPiatto): Piatto {
  return {
    id: r.id, categoriaId: r.categoria_id, numero: r.numero, nome: r.nome, descrizione: r.descrizione,
    prezzoCent: r.prezzo_cent, piccante: r.piccante, vegetariano: r.vegetariano, dellaCasa: r.della_casa,
    allergeni: r.allergeni, allergeniConfermati: r.allergeni_confermati, disponibile: r.disponibile, posizione: r.posizione,
  }
}

export async function leggiMenu(db: Db): Promise<CategoriaConPiatti[]> {
  const categorie = await db.query<{ id: string; nome: string; pezzi: string | null; posizione: number }>(
    'select id, nome, pezzi, posizione from categorie order by posizione',
  )
  const piatti = await db.query<RigaPiatto>(`select ${COLONNE} from piatti order by posizione, numero nulls last`)
  return categorie.map((c) => ({ ...c, piatti: piatti.filter((p) => p.categoria_id === c.id).map(daRiga) }))
}

export async function leggiPiatto(db: Db, id: string): Promise<Piatto | null> {
  if (!UUID.test(id)) return null
  const [r] = await db.query<RigaPiatto>(`select ${COLONNE} from piatti where id = $1`, [id])
  return r ? daRiga(r) : null
}

export async function aggiornaPiatto(db: Db, id: string, d: DatiPiatto): Promise<Piatto | null> {
  if (!UUID.test(id)) return null
  const [r] = await db.query<RigaPiatto>(
    `update piatti set nome = $2, descrizione = $3, prezzo_cent = $4, piccante = $5, vegetariano = $6,
       della_casa = $7, allergeni = $8::text[], allergeni_confermati = $9, aggiornato_il = now()
     where id = $1 returning ${COLONNE}`,
    [id, d.nome, d.descrizione, d.prezzoCent, d.piccante, d.vegetariano, d.dellaCasa, d.allergeni, d.allergeniConfermati],
  )
  return r ? daRiga(r) : null
}

export async function impostaDisponibile(db: Db, id: string, disponibile: boolean): Promise<boolean> {
  if (!UUID.test(id)) return false
  const righe = await db.query('update piatti set disponibile = $2, aggiornato_il = now() where id = $1 returning id', [id, disponibile])
  return righe.length === 1
}

export async function contaAllergeniDaConfermare(db: Db): Promise<number> {
  const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from piatti where not allergeni_confermati')
  return n
}
