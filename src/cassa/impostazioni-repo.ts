import type { Db } from '@/server/db-tipi'
import type { StampaReparti } from '@/stampa/instradamento'
/** `stampa`: reparti che ricevono le comande su carta (le bevande della sala escono alla cassa). */
export interface ImpostazioniCassa { copertoCent: number; stampa: StampaReparti }

export async function leggiImpostazioniCassa(db: Db): Promise<ImpostazioniCassa> {
  const [i] = await db.query<{ copertoCent: number; banco: boolean; cucina: boolean; sala: boolean }>(
    'select coperto_cent as "copertoCent",stampa_banco as banco,stampa_cucina as cucina,stampa_sala as sala from impostazioni_cassa where id=1')
  return { copertoCent: i.copertoCent,stampa: { banco: i.banco,cucina: i.cucina,sala: i.sala } }
}
export async function salvaImpostazioniCassa(db: Db, i: ImpostazioniCassa): Promise<void> {
  await db.query('update impostazioni_cassa set coperto_cent=$1,stampa_banco=$2,stampa_cucina=$3,stampa_sala=$4 where id=1',[i.copertoCent,i.stampa.banco,i.stampa.cucina,i.stampa.sala])
}
