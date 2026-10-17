import type { Db } from '@/server/db-tipi'
import type { TipoEmail } from '@/domain/email-ordini'
export interface EmailDaInviare { id: string; ordineId: string; tipo: TipoEmail; tentativi: number }
export const MASSIMO_TENTATIVI_EMAIL = 5
/**
 * Prende in carico fino a `limite` email non inviate di ordini non anonimizzati.
 * Una presa in carico vale 2 minuti: se l'invio si interrompe, l'email torna disponibile.
 */
export async function prendiEmailDaInviare(db: Db, limite = 10): Promise<EmailDaInviare[]> {
  return db.query<EmailDaInviare>(`update email_ordini set in_invio_dal=clock_timestamp(),tentativi=tentativi+1 where id in (
    select e.id from email_ordini e join ordini o on o.id=e.ordine_id
    where e.inviata_il is null and e.tentativi < $1 and o.anonimizzato_il is null and (e.in_invio_dal is null or e.in_invio_dal < clock_timestamp() - interval '2 minutes')
    order by e.creata_il limit $2 for update of e skip locked
  ) returning id,ordine_id as "ordineId",tipo,tentativi`,[MASSIMO_TENTATIVI_EMAIL,limite])
}
export async function segnaInviata(db: Db, id: string): Promise<void> {
  await db.query('update email_ordini set inviata_il=clock_timestamp(),in_invio_dal=null,ultimo_errore=null where id=$1',[id])
}
export async function segnaErrore(db: Db, id: string, errore: string): Promise<void> {
  await db.query('update email_ordini set in_invio_dal=null,ultimo_errore=$2 where id=$1',[id,errore.slice(0,500)])
}
export interface EmailInErrore { n: number; ultimoErrore: string | null; ultimaIl: Date | null }
/**
 * Email che hanno esaurito i tentativi senza partire, di ordini non ancora anonimizzati (gli stessi che
 * `prendiEmailDaInviare` considera): quante sono, e l'errore e la data di creazione della più recente.
 */
export async function emailInErroreDefinitivo(db: Db): Promise<EmailInErrore> {
  const [r] = await db.query<{ n: number; ultimoErrore: string | null; ultimaIl: Date | null }>(`select count(*)::int as n,
    (array_agg(e.ultimo_errore order by e.creata_il desc,e.id desc))[1] as "ultimoErrore",max(e.creata_il) as "ultimaIl"
    from email_ordini e join ordini o on o.id=e.ordine_id
    where e.inviata_il is null and e.tentativi >= $1 and o.anonimizzato_il is null`,[MASSIMO_TENTATIVI_EMAIL])
  return { n: r.n,ultimoErrore: r.ultimoErrore ?? null,ultimaIl: r.ultimaIl ? new Date(r.ultimaIl) : null }
}
