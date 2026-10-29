import type { Db } from '@/server/db-tipi'
export interface ImpostazioniCassa { copertoCent: number }

export async function leggiImpostazioniCassa(db: Db): Promise<ImpostazioniCassa> {
  const [i] = await db.query<ImpostazioniCassa>('select coperto_cent as "copertoCent" from impostazioni_cassa where id=1')
  return i
}
export async function salvaImpostazioniCassa(db: Db, i: ImpostazioniCassa): Promise<void> {
  await db.query('update impostazioni_cassa set coperto_cent=$1 where id=1',[i.copertoCent])
}
