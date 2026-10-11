import type { Db } from '@/server/db-tipi'
import type { Ruolo } from './regole'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function leggiRuolo(db: Db, userId: string): Promise<Ruolo | null> {
  if (!UUID.test(userId)) return null
  const [r] = await db.query<{ ruolo: Ruolo }>('select ruolo from profili where user_id = $1', [userId])
  return r?.ruolo ?? null
}

export async function assegnaRuoloPerEmail(db: Db, email: string, ruolo: Ruolo): Promise<boolean> {
  const righe = await db.query(
    `insert into profili (user_id, ruolo)
       select id, $2 from auth.users where lower(email) = lower($1)
     on conflict (user_id) do update set ruolo = excluded.ruolo
     returning user_id`,
    [email, ruolo],
  )
  return righe.length === 1
}
