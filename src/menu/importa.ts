import { euroInCentesimi } from '@/domain/soldi'
import { repartoSeed, type Reparto } from '@/domain/reparti'

export interface MenuJson {
  categorie: Array<{
    id: string
    nome: string
    pezzi?: string
    voci: Array<{ num?: number; nome: string; prezzo: number; desc?: string; piccante?: boolean | string; veg?: boolean; casa?: boolean }>
    componi?: { titolo: string; gruppi: Array<{ nome: string; voci: string[] }> }
  }>
}

export interface RigaCategoria { id: string; nome: string; pezzi: string | null; posizione: number; reparto: Reparto }

export interface RigaPiatto {
  categoria_id: string
  numero: number | null
  nome: string
  descrizione: string | null
  prezzo_cent: number
  piccante: boolean
  vegetariano: boolean
  della_casa: boolean
  posizione: number
}

export interface GruppoPoke { nome: string; voci: string[]; min: number; max: number; inclusi: number }

export interface PokeConfig {
  titolo: string
  gruppi: GruppoPoke[]
  prezzoBaseCent: number | null
  prezzoExtraCent: number | null
}

export interface MenuConvertito { categorie: RigaCategoria[]; piatti: RigaPiatto[]; poke: PokeConfig | null }

// Regole provvisorie finché Daniel non dà le sue (spec §9). Il prezzo resta null: senza prezzo la poke composta non è ordinabile.
const REGOLE_POKE_PROVVISORIE: Record<string, Pick<GruppoPoke, 'min' | 'max' | 'inclusi'>> = {
  Base: { min: 1, max: 1, inclusi: 1 },
  Proteine: { min: 1, max: 3, inclusi: 2 },
  Condimenti: { min: 0, max: 6, inclusi: 4 },
  Salse: { min: 0, max: 3, inclusi: 2 },
  Topping: { min: 0, max: 3, inclusi: 2 },
}
const REGOLA_DEFAULT = { min: 0, max: 3, inclusi: 2 }

export function convertiMenu(json: MenuJson): MenuConvertito {
  const categorie: RigaCategoria[] = []
  const piatti: RigaPiatto[] = []
  let poke: PokeConfig | null = null

  json.categorie.forEach((c, i) => {
    categorie.push({ id: c.id, nome: c.nome, pezzi: c.pezzi ?? null, posizione: i + 1, reparto: repartoSeed(c.id) })
    c.voci.forEach((v, j) => {
      piatti.push({
        categoria_id: c.id,
        numero: v.num ?? null,
        nome: v.nome,
        descrizione: v.desc?.trim() ? v.desc.trim() : null,
        prezzo_cent: euroInCentesimi(v.prezzo),
        piccante: Boolean(v.piccante),
        vegetariano: Boolean(v.veg),
        della_casa: Boolean(v.casa),
        posizione: j + 1,
      })
    })
    if (c.componi) {
      poke = {
        titolo: c.componi.titolo,
        gruppi: c.componi.gruppi.map((g) => ({ nome: g.nome, voci: [...g.voci], ...(REGOLE_POKE_PROVVISORIE[g.nome] ?? REGOLA_DEFAULT) })),
        prezzoBaseCent: null,
        prezzoExtraCent: null,
      }
    }
  })

  return { categorie, piatti, poke }
}
