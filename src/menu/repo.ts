import type { Db } from '@/server/db-tipi'
import type { CodiceAllergene } from '@/domain/allergeni'
import type { Reparto } from '@/domain/reparti'
import type { InfoFoto } from '@/domain/foto'
import type { DatiVino, TipoCategoria } from '@/domain/vini'

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
  /** Foto del piatto (senza i byte, che servono solo alla rotta /foto). */
  foto: InfoFoto | null
  /** Solo per le voci della carta dei vini. */
  vino: DatiVino | null
}

export interface CategoriaConPiatti { id: string; nome: string; pezzi: string | null; posizione: number; reparto: Reparto; tipo: TipoCategoria; piatti: Piatto[] }

export interface DatiPiatto {
  nome: string
  descrizione: string | null
  prezzoCent: number
  piccante: boolean
  vegetariano: boolean
  dellaCasa: boolean
  allergeni: CodiceAllergene[]
  allergeniConfermati: boolean
  /** null toglie i dati del vino; assente li lascia come sono. */
  vino?: DatiVino | null
}

interface RigaPiatto {
  id: string; categoria_id: string; numero: number | null; nome: string; descrizione: string | null
  prezzo_cent: number; piccante: boolean; vegetariano: boolean; della_casa: boolean
  allergeni: CodiceAllergene[]; allergeni_confermati: boolean; disponibile: boolean; posizione: number
  foto_versione: string | null; foto_larghezza: number | null; foto_altezza: number | null
  vino_tipologia: DatiVino['tipologia'] | null; vino_formato: DatiVino['formato'] | null; vino_cantina: string | null; vino_denominazione: string | null; vino_annata: number | null
}

const COLONNE = `id, categoria_id, numero, nome, descrizione, prezzo_cent, piccante, vegetariano, della_casa,
  allergeni, allergeni_confermati, disponibile, posizione, vino_tipologia, vino_formato, vino_cantina, vino_denominazione, vino_annata`
// Piatti con le dimensioni e la versione della foto (left join: senza foto sono null).
const CON_FOTO = `${COLONNE.replace(/(\w+)/g,'p.$1')}, f.versione as foto_versione, f.larghezza as foto_larghezza, f.altezza as foto_altezza
  from piatti p left join foto_piatti f on f.piatto_id = p.id`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function daRiga(r: RigaPiatto): Piatto {
  return {
    id: r.id, categoriaId: r.categoria_id, numero: r.numero, nome: r.nome, descrizione: r.descrizione,
    prezzoCent: r.prezzo_cent, piccante: r.piccante, vegetariano: r.vegetariano, dellaCasa: r.della_casa,
    allergeni: r.allergeni, allergeniConfermati: r.allergeni_confermati, disponibile: r.disponibile, posizione: r.posizione,
    foto: r.foto_versione ? { versione: r.foto_versione, larghezza: r.foto_larghezza!, altezza: r.foto_altezza! } : null,
    vino: r.vino_tipologia && r.vino_formato ? { tipologia: r.vino_tipologia, formato: r.vino_formato, cantina: r.vino_cantina, denominazione: r.vino_denominazione, annata: r.vino_annata } : null,
  }
}

export async function leggiMenu(db: Db): Promise<CategoriaConPiatti[]> {
  const categorie = await db.query<Omit<CategoriaConPiatti, 'piatti'>>(
    'select id, nome, pezzi, posizione, reparto, tipo from categorie order by posizione',
  )
  const piatti = await db.query<RigaPiatto>(`select ${CON_FOTO} order by p.posizione, p.numero nulls last`)
  return categorie.map((c) => ({ ...c, piatti: piatti.filter((p) => p.categoria_id === c.id).map(daRiga) }))
}

export async function leggiPiatto(db: Db, id: string): Promise<Piatto | null> {
  if (!UUID.test(id)) return null
  const [r] = await db.query<RigaPiatto>(`select ${CON_FOTO} where p.id = $1`, [id])
  return r ? daRiga(r) : null
}

export async function aggiornaPiatto(db: Db, id: string, d: DatiPiatto): Promise<Piatto | null> {
  if (!UUID.test(id)) return null
  const vino = d.vino === undefined ? '' : ', vino_tipologia = $10, vino_formato = $11, vino_cantina = $12, vino_denominazione = $13, vino_annata = $14'
  const [r] = await db.query<RigaPiatto>(
    `update piatti set nome = $2, descrizione = $3, prezzo_cent = $4, piccante = $5, vegetariano = $6,
       della_casa = $7, allergeni = $8::text[], allergeni_confermati = $9, aggiornato_il = now()${vino}
     where id = $1 returning id`,
    [id, d.nome, d.descrizione, d.prezzoCent, d.piccante, d.vegetariano, d.dellaCasa, d.allergeni, d.allergeniConfermati, ...parametriVino(d.vino)],
  )
  return r ? leggiPiatto(db, id) : null
}

function parametriVino(v: DatiVino | null | undefined): unknown[] {
  if (v === undefined) return []
  return [v?.tipologia ?? null, v?.formato ?? null, v?.cantina ?? null, v?.denominazione ?? null, v?.annata ?? null]
}

export type EsitoNuovoPiatto = { ok: true; id: string } | { ok: false; errore: 'categoria' | 'numero' }
/** Piatto nuovo in fondo alla sua categoria. Il numero è facoltativo ma unico in tutto il menù. */
export async function creaPiatto(db: Db, categoriaId: string, numero: number | null, d: DatiPiatto): Promise<EsitoNuovoPiatto> {
  try {
    const [r] = await db.query<{ id: string }>(
      `insert into piatti (categoria_id, numero, nome, descrizione, prezzo_cent, piccante, vegetariano, della_casa, allergeni, allergeni_confermati, posizione,
         vino_tipologia, vino_formato, vino_cantina, vino_denominazione, vino_annata)
       select c.id, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, coalesce((select max(posizione) from piatti where categoria_id = c.id), 0) + 1, $11, $12, $13, $14, $15
       from categorie c where c.id = $1 returning id`,
      [categoriaId, numero, d.nome, d.descrizione, d.prezzoCent, d.piccante, d.vegetariano, d.dellaCasa, d.allergeni, d.allergeniConfermati, ...parametriVino(d.vino ?? null)],
    )
    return r ? { ok: true, id: r.id } : { ok: false, errore: 'categoria' }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') return { ok: false, errore: 'numero' }
    throw err
  }
}

export async function impostaDisponibile(db: Db, id: string, disponibile: boolean): Promise<boolean> {
  if (!UUID.test(id)) return false
  const righe = await db.query('update piatti set disponibile = $2, aggiornato_il = now() where id = $1 returning id', [id, disponibile])
  return righe.length === 1
}

/** Reparto che prepara la categoria. Vale per gli ordini da adesso: le righe già inviate tengono il loro. */
export async function aggiornaRepartoCategoria(db: Db, id: string, reparto: Reparto): Promise<boolean> {
  const righe = await db.query('update categorie set reparto = $2 where id = $1 returning id', [id, reparto])
  return righe.length === 1
}

export async function contaAllergeniDaConfermare(db: Db): Promise<number> {
  const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from piatti where not allergeni_confermati')
  return n
}
