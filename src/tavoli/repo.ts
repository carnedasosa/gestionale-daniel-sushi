import type { Db } from '@/server/db-tipi'
import { generaCodice } from '@/domain/codice-tavolo'
import { generaChiaveTavolo } from '@/domain/chiave-tavolo'
import { idValido, nomeValido, slugValido, chiaveValida } from './validazione'
import type { ErroriCodice } from '@/domain/limiti-tentativi'

export interface Tavolo { id: string; nome: string; slug: string; chiave: string; posizione: number; attivo: boolean }
export interface SessioneAperta { id: string; tavoloId: string; codice: string; apertaIl: Date }
export interface TavoloConSessione extends Tavolo { sessione: (SessioneAperta & { tentativi: number }) | null }
const SESSIONE = 'id, tavolo_id as "tavoloId", codice, aperta_il as "apertaIl"'

export async function elencoTavoli(db: Db): Promise<TavoloConSessione[]> {
  const tavoli = await db.query<Tavolo>('select * from tavoli order by posizione,nome')
  const sessioni = await db.query<SessioneAperta & { tentativi: number }>(`select ${SESSIONE},(select count(*)::int from tentativi_codice e where e.sessione_id=sessioni_tavolo.id and e.creato_il>now()-interval '10 minutes') as tentativi from sessioni_tavolo where chiusa_il is null`)
  return tavoli.map(t => ({ ...t, sessione: sessioni.find(s => s.tavoloId === t.id) ?? null }))
}
export async function tavoloDaChiave(db: Db, chiave: string): Promise<Tavolo | null> {
  if (!chiaveValida(chiave)) return null
  return (await db.query<Tavolo>('select * from tavoli where chiave=$1 and attivo', [chiave]))[0] ?? null
}
export async function rigeneraChiave(db: Db, id: string): Promise<Tavolo | null> {
  if (!idValido(id)) return null
  for (let i=0; i<10; i++) {
    try { return (await db.query<Tavolo>('update tavoli set chiave=$2 where id=$1 and chiave<>$2 returning *',[id,generaChiaveTavolo()]))[0] ?? null }
    catch (err) { if (err && typeof err === 'object' && 'code' in err && err.code === '23505') continue; throw err }
  }
  throw new Error('Impossibile generare il nuovo QR: riprova')
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
export type EsitoChiusura = { ok: true } | { ok: false; motivo: 'ordini_in_cucina' | 'ordini_dopo_conto' | 'sessione_non_valida'; n: number }
export async function chiudiSessione(db: Db, sessioneId: string,contoVistoAlle: Date | null = null,forza = false): Promise<EsitoChiusura> {
  const invalida = { ok: false as const,motivo: 'sessione_non_valida' as const,n: 0 }
  if (!idValido(sessioneId) || typeof forza !== 'boolean' || (contoVistoAlle !== null && !(contoVistoAlle instanceof Date && Number.isFinite(contoVistoAlle.getTime())))) return invalida
  return db.transazione(async tx => {
    const [s] = await tx.query<{ chiusa: Date | null }>('select chiusa_il as chiusa from sessioni_tavolo where id=$1 for update',[sessioneId])
    if (!s) return invalida
    if (s.chiusa) return { ok: true }
    const [n] = await tx.query<{ cucina: number; dopo: number }>(`select count(*) filter(where stato in ('inviato','in_preparazione'))::int as cucina,count(*) filter(where creato_il>$2)::int as dopo from ordini where sessione_id=$1 and stato<>'annullato'`,[sessioneId,contoVistoAlle])
    if (!forza && n.dopo>0) return { ok: false,motivo: 'ordini_dopo_conto',n: n.dopo }
    if (!forza && n.cucina>0) return { ok: false,motivo: 'ordini_in_cucina',n: n.cucina }
    await tx.query('update sessioni_tavolo set chiusa_il=clock_timestamp() where id=$1',[sessioneId])
    return { ok: true }
  })
}
export interface ContoRecente { id: string; tavoloNome: string; chiusaIl: Date }
export async function contiRecenti(db: Db): Promise<ContoRecente[]> {
  return db.query<ContoRecente>(`select s.id,t.nome as "tavoloNome",s.chiusa_il as "chiusaIl" from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.chiusa_il>=now()-interval '6 hours' order by s.chiusa_il desc`)
}
export interface SessioneConTavolo extends SessioneAperta { tavoloChiave: string; chiusaIl: Date | null }
export async function sessionePerId(db: Db, sessioneId: string): Promise<SessioneConTavolo | null> {
  if (!idValido(sessioneId)) return null
  return (await db.query<SessioneConTavolo>(`select s.id,s.tavolo_id as "tavoloId",s.codice,s.aperta_il as "apertaIl",s.chiusa_il as "chiusaIl",t.chiave as "tavoloChiave" from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1`,[sessioneId]))[0] ?? null
}
export async function sessioneApertaPerId(db: Db, id: string): Promise<SessioneConTavolo | null> {
  const s = await sessionePerId(db,id)
  return s && !s.chiusaIl ? s : null
}
export async function sessioneDelTavolo(db: Db, tavoloId: string): Promise<SessioneAperta | null> {
  if (!idValido(tavoloId)) return null
  return (await db.query<SessioneAperta>(`select ${SESSIONE} from sessioni_tavolo where tavolo_id=$1 and chiusa_il is null`,[tavoloId]))[0] ?? null
}
export async function registraTentativoFallito(db: Db, d: { tavoloId: string; sessioneId: string; dispositivo: string; ip: string }): Promise<void> {
  if (!idValido(d.tavoloId) || !idValido(d.sessioneId) || !idValido(d.dispositivo) || typeof d.ip !== 'string') return
  await db.query('insert into tentativi_codice(tavolo_id,sessione_id,dispositivo,ip) values ($1,$2,$3,$4)',[d.tavoloId,d.sessioneId,d.dispositivo,d.ip])
}
export async function contaErrori(db: Db, d: { sessioneId: string; dispositivo: string; ip: string; minuti: number }): Promise<ErroriCodice> {
  if (!idValido(d.sessioneId) || !idValido(d.dispositivo) || typeof d.ip !== 'string' || !Number.isSafeInteger(d.minuti) || d.minuti<1) return { dispositivo: 0,ip: 0,sessione: 0 }
  return (await db.query<ErroriCodice>(`select count(*)::int as sessione,count(*) filter(where dispositivo=$2)::int as dispositivo,count(*) filter(where ip=$3)::int as ip from tentativi_codice where sessione_id=$1 and creato_il>now()-($4*interval '1 minute')`,[d.sessioneId,d.dispositivo,d.ip,d.minuti]))[0]
}
export async function sbloccaSessione(db: Db, id: string): Promise<boolean> {
  if (!idValido(id)) return false
  await db.query('delete from tentativi_codice where sessione_id=$1',[id])
  return true
}
export async function verificaCodice(db: Db, tavoloId: string, codice: string): Promise<SessioneAperta | null> {
  if (!idValido(tavoloId) || typeof codice !== 'string' || !/^\d{4}$/.test(codice)) return null
  return (await db.query<SessioneAperta>(`select ${SESSIONE} from sessioni_tavolo where tavolo_id=$1 and codice=$2 and chiusa_il is null`, [tavoloId,codice]))[0] ?? null
}
