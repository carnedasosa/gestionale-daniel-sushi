import type { Db } from '@/server/db-tipi'
import type { ErroriAccesso } from '@/domain/limiti-accesso'

/**
 * Registra il tentativo PRIMA di chiedere a Supabase e dice quanti errori c'erano già, escluso questo. Se la password è
 * giusta o Supabase ha un guasto, annullaTentativoAccesso lo toglie: restano solo gli errori veri. Così anche N login in
 * parallelo si vedono l'un l'altro e ne passano al massimo LIMITE_EMAIL; contando prima e registrando dopo, passerebbero
 * tutti. Niente lock né transazione aperta durante la chiamata a Supabase, che occuperebbe una connessione del pool:
 * non chiamarla dentro db.transazione, le due istruzioni devono essere visibili agli altri appena fatte.
 * `rete` è quella di ipDaHeaders, o null se l'indirizzo non è noto: allora si conta solo per email.
 */
export async function prenotaTentativoAccesso(db: Db, d: { chiave: string; rete: string | null; minuti: number }): Promise<{ id: string; errori: ErroriAccesso }> {
  const [{ id }] = await db.query<{ id: string }>('insert into tentativi_accesso(email_hash,rete) values ($1,$2) returning id::text as id',[d.chiave,d.rete])
  const [errori] = await db.query<ErroriAccesso>(`select count(*) filter (where email_hash=$1)::int as email,count(*) filter (where rete=$2)::int as rete
    from tentativi_accesso where (email_hash=$1 or rete=$2) and id<>$3::bigint and creato_il>now()-($4*interval '1 minute')`,[d.chiave,d.rete,id,d.minuti])
  return { id,errori }
}

export async function annullaTentativoAccesso(db: Db, id: string): Promise<void> {
  await db.query('delete from tentativi_accesso where id=$1::bigint',[id])
}

/** Cancella i tentativi (impronta dell'email e rete) più vecchi di `giorni` giorni. Idempotente; la chiama il cron notturno. */
export async function eliminaTentativiAccessoVecchi(db: Db, adesso: Date, giorni = 30): Promise<number> {
  if (Number.isNaN(adesso.getTime()) || !Number.isSafeInteger(giorni) || giorni < 1) throw new Error('Parametri della pulizia dei tentativi di accesso non validi')
  return (await db.query<{ n: number }>(`with tolti as (delete from tentativi_accesso where creato_il < $1::timestamptz - make_interval(days => $2::int) returning 1)
    select count(*)::int as n from tolti`,[adesso,giorni]))[0].n
}
