import type { Db } from '@/server/db-tipi'
import type { PokeConfig } from '@/menu/importa'

export async function leggiPokeConfig(db: Db): Promise<PokeConfig | null> {
  return (await db.query<PokeConfig>('select titolo,gruppi,prezzo_base_cent as "prezzoBaseCent",prezzo_extra_cent as "prezzoExtraCent" from poke_config where id=1'))[0] ?? null
}
export async function salvaPokeConfig(db: Db, c: PokeConfig): Promise<void> {
  await db.query('update poke_config set titolo=$1,gruppi=$2::jsonb,prezzo_base_cent=$3,prezzo_extra_cent=$4 where id=1', [c.titolo,JSON.stringify(c.gruppi),c.prezzoBaseCent,c.prezzoExtraCent])
}
