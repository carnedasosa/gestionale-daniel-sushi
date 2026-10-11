import type { Db } from '@/server/db-tipi'
import { generaCodice } from '@/domain/codice-tavolo'
import { generaChiaveTavolo } from '@/domain/chiave-tavolo'
import { idValido, nomeValido, slugValido } from './validazione'

export interface Tavolo { id: string; nome: string; slug: string; posizione: number; attivo: boolean }
export interface SessioneAperta { id: string; tavoloId: string; codice: string; apertaIl: Date }
export interface TavoloConSessione extends Tavolo { sessione: SessioneAperta | null }
const SESSIONE = 'id, tavolo_id as "tavoloId", codice, aperta_il as "apertaIl"'

export async function elencoTavoli(db: Db): Promise<TavoloConSessione[]> {
  const tavoli = await db.query<Tavolo>('select * from tavoli order by posizione,nome')
  const sessioni = await db.query<SessioneAperta>(`select ${SESSIONE} from sessioni_tavolo where chiusa_il is null`)
  return tavoli.map(t => ({ ...t, sessione: sessioni.find(s => s.tavoloId === t.id) ?? null }))
}
export async function tavoloDaSlug(db: Db, slug: string): Promise<Tavolo | null> {
  if (!slugValido(slug)) return null
  return (await db.query<Tavolo>('select * from tavoli where slug=$1 and attivo', [slug]))[0] ?? null
}
export async function creaTavolo(db: Db, nome: string, slug: string): Promise<Tavolo> {
  if (!nomeValido(nome) || !slugValido(slug)) throw new Error('Nome o slug del tavolo non valido')
  return (await db.query<Tavolo>('insert into tavoli(nome,slug,chiave) values ($1,$2,$3) returning *', [nome.trim(), slug,generaChiaveTavolo()]))[0]
}
export async function aggiornaTavolo(db: Db, id: string, d: { nome: string; attivo: boolean; posizione: number }): Promise<Tavolo | null> {
  if (!idValido(id) || !nomeValido(d.nome) || typeof d.attivo !== 'boolean' || !Number.isSafeInteger(d.posizione)) return null
  return db.transazione(async tx => {
    await tx.query('select id from tavoli where id=$1 for update',[id])
    return (await tx.query<Tavolo>(`update tavoli set nome=$2,attivo=$3,posizione=$4 where id=$1
      and ($3 or not exists(select 1 from sessioni_tavolo where tavolo_id=$1 and chiusa_il is null)) returning *`, [id,d.nome.trim(),d.attivo,d.posizione]))[0] ?? null
  })
}
export async function apriSessione(db: Db, tavoloId: string, genera: () => string = generaCodice): Promise<SessioneAperta> {
  if (!idValido(tavoloId)) throw new Error('Tavolo non trovato')
  return db.transazione(async tx => {
    const [tavolo] = await tx.query('select id from tavoli where id=$1 and attivo for update',[tavoloId])
    if (!tavolo) throw new Error('Tavolo non trovato o disattivato')
    for (let i = 0; i < 10; i++) {
    const [esistente] = await tx.query<SessioneAperta>(`select ${SESSIONE} from sessioni_tavolo where tavolo_id=$1 and chiusa_il is null`, [tavoloId])
    if (esistente) return esistente
    const codice = genera()
    if (!/^\d{4}$/.test(codice)) throw new Error('Codice non valido')
    const [r] = await tx.query<SessioneAperta>(`insert into sessioni_tavolo(tavolo_id,codice)
      select id,$2 from tavoli where id=$1 and attivo
      and $2 <> coalesce((select codice from sessioni_tavolo where tavolo_id=$1 order by aperta_il desc limit 1),'')
      on conflict do nothing returning ${SESSIONE}`, [tavoloId,codice])
    if (r) return r
  }
  throw new Error('Impossibile aprire il tavolo: riprova')
  })
}
export async function chiudiSessione(db: Db, sessioneId: string): Promise<boolean> {
  if (!idValido(sessioneId)) return false
  return (await db.query('update sessioni_tavolo set chiusa_il=now() where id=$1 and chiusa_il is null returning id', [sessioneId])).length === 1
}
export async function sessioneApertaPerId(db: Db, sessioneId: string): Promise<(SessioneAperta & { tavoloSlug: string }) | null> {
  if (!idValido(sessioneId)) return null
  return (await db.query<SessioneAperta & { tavoloSlug: string }>(`select s.id,s.tavolo_id as "tavoloId",s.codice,s.aperta_il as "apertaIl",t.slug as "tavoloSlug"
    from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1 and s.chiusa_il is null and t.attivo`, [sessioneId]))[0] ?? null
}
export async function registraTentativoFallito(db: Db, tavoloId: string, dispositivo: string): Promise<void> {
  if (!idValido(tavoloId) || !idValido(dispositivo)) return
  await db.query('insert into tentativi_codice(tavolo_id,dispositivo) values ($1,$2)', [tavoloId,dispositivo])
}
export async function contaErrori(db: Db, tavoloId: string, dispositivo: string, minuti: number): Promise<{ dispositivo: number; tavolo: number }> {
  if (!idValido(tavoloId) || !idValido(dispositivo) || !Number.isSafeInteger(minuti) || minuti < 1) return { dispositivo: 0, tavolo: 0 }
  return (await db.query<{ dispositivo: number; tavolo: number }>(`select count(*)::int as tavolo,count(*) filter(where dispositivo=$2)::int as dispositivo
    from tentativi_codice where tavolo_id=$1 and creato_il > now()-($3 * interval '1 minute')`, [tavoloId,dispositivo,minuti]))[0]
}
export async function verificaCodice(db: Db, tavoloId: string, codice: string): Promise<SessioneAperta | null> {
  if (!idValido(tavoloId) || typeof codice !== 'string' || !/^\d{4}$/.test(codice)) return null
  return (await db.query<SessioneAperta>(`select ${SESSIONE} from sessioni_tavolo where tavolo_id=$1 and codice=$2 and chiusa_il is null`, [tavoloId,codice]))[0] ?? null
}
