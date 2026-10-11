import type { Db } from '@/server/db-tipi'
import type { PokeConfig } from '@/menu/importa'

export async function leggiPokeConfig(db: Db): Promise<PokeConfig | null> {
  const c = (await db.query<PokeConfig>('select titolo,gruppi,prezzo_base_cent as "prezzoBaseCent",prezzo_extra_cent as "prezzoExtraCent" from poke_config where id=1'))[0]
  if (!c) return null
  const testo = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const prezzo = (v: unknown) => v === null || (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 2147483647)
  const valida = testo(c.titolo) && prezzo(c.prezzoBaseCent) && prezzo(c.prezzoExtraCent) && Array.isArray(c.gruppi) && c.gruppi.length > 0 && c.gruppi.every(g =>
    g && typeof g === 'object' && testo(g.nome) && Array.isArray(g.voci) && g.voci.every(testo) && new Set(g.voci).size === g.voci.length &&
    [g.min,g.max,g.inclusi].every(Number.isSafeInteger) && g.min >= 0 && g.min <= g.max && g.max <= g.voci.length && g.inclusi >= 0 && g.inclusi <= g.max
  ) && new Set(c.gruppi.map(g => g.nome)).size === c.gruppi.length
  if (!valida) { console.error('poke_config non valida'); return null }
  return c
}
export async function salvaPokeConfig(db: Db, c: PokeConfig): Promise<void> {
  await db.query('update poke_config set titolo=$1,gruppi=$2::text::jsonb,prezzo_base_cent=$3,prezzo_extra_cent=$4 where id=1', [c.titolo,JSON.stringify(c.gruppi),c.prezzoBaseCent,c.prezzoExtraCent])
}
