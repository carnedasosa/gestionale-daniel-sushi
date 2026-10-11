import type { Db } from '@/server/db-tipi'
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { prossimoStato, type StatoOrdineTavolo } from '@/domain/stati-tavolo'
import { leggiPokeConfig } from './poke-repo'
import { idValido } from './validazione'

export interface RigaOrdine { id: string; numero: number | null; nome: string; prezzoUnitCent: number; quantita: number; nota: string | null; poke: SceltePoke | null; annullata: boolean }
export interface Ordine { id: string; numero: number; stato: StatoOrdineTavolo; totaleCent: number; creatoIl: Date; sessioneId: string; tavoloNome: string; righe: RigaOrdine[] }
export type OrdineClient = Omit<Ordine,'creatoIl'> & { creatoIl: string }
export type EsitoCreazione = { ok: true; ordine: Ordine } | { ok: false; errore: string; nonDisponibili?: string[] }
const COLONNE_ORDINE = `o.id,o.numero,o.stato,o.totale_cent as "totaleCent",o.creato_il as "creatoIl",o.sessione_id as "sessioneId",t.nome as "tavoloNome"`
const COLONNE_RIGA = `id,numero,nome,prezzo_unit_cent as "prezzoUnitCent",quantita,nota,poke,annullata`
async function leggiOrdini(db: Db, condizione: string, parametri: unknown[] = []): Promise<Ordine[]> {
  const ordini = await db.query<Omit<Ordine,'righe'>>(`select ${COLONNE_ORDINE} from ordini o join sessioni_tavolo s on s.id=o.sessione_id join tavoli t on t.id=s.tavolo_id where ${condizione} order by o.creato_il,o.numero`,parametri)
  if (!ordini.length) return []
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordini.map(o => o.id)])
  return ordini.map(o => ({ ...o,righe: righe.filter(r => r.ordineId === o.id).map(r => ({ id: r.id, numero: r.numero, nome: r.nome, prezzoUnitCent: r.prezzoUnitCent, quantita: r.quantita, nota: r.nota, poke: r.poke, annullata: r.annullata })) }))
}
export async function creaOrdineTavolo(db: Db, sessioneId: string, input: RigaCarrello[]): Promise<EsitoCreazione> {
  const chiuso = { ok: false as const, errore: 'Il tavolo è stato chiuso: chiedi al personale' }
  if (!idValido(sessioneId)) return chiuso
  const carrello = validaCarrello(input)
  if (!carrello.ok) return carrello
  return db.transazione(async tx => {
    const [s] = await tx.query(`select s.id from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1 and s.chiusa_il is null and t.attivo for update of s`,[sessioneId])
    if (!s) return chiuso
    const ids = [...new Set(carrello.righe.flatMap(r => r.piattoId ? [r.piattoId] : []))].sort()
    const piatti = await tx.query<{ id: string; numero: number | null; nome: string; prezzo_cent: number; disponibile: boolean }>('select id,numero,nome,prezzo_cent,disponibile from piatti where id=any($1::uuid[]) order by id for share',[ids])
    const nonDisponibili = ids.filter(id => !piatti.find(p => p.id === id)?.disponibile).map(id => piatti.find(p => p.id === id)?.nome ?? 'Piatto non più in menù')
    if (nonDisponibili.length) return { ok: false, errore: 'Alcuni piatti non sono più disponibili', nonDisponibili }
    if (carrello.righe.some(r => r.piattoId === null)) await tx.query('select id from poke_config where id=1 for share')
    const config = carrello.righe.some(r => r.piattoId === null) ? await leggiPokeConfig(tx) : null
    const righe: (Omit<RigaOrdine,'id' | 'annullata'> & { piattoId: string | null })[] = []
    for (const r of carrello.righe) {
      if (r.piattoId) {
        const p = piatti.find(p => p.id === r.piattoId)!
        righe.push({ piattoId: p.id, numero: p.numero, nome: p.nome, prezzoUnitCent: p.prezzo_cent, quantita: r.quantita, nota: r.nota || null, poke: null })
      } else {
        if (!config) return { ok: false, errore: 'La poke composta non è ancora disponibile' }
        const poke = validaPoke(config,r.poke)
        if (!poke.ok) return poke
        righe.push({ piattoId: null, numero: null, nome: 'Poke composta', prezzoUnitCent: poke.prezzoCent, quantita: r.quantita, nota: r.nota || null, poke: poke.scelte })
      }
    }
    const totale = righe.reduce((s,r) => s + r.prezzoUnitCent * r.quantita,0)
    if (!Number.isSafeInteger(totale) || totale > 2147483647) return { ok: false, errore: 'Il totale dell’ordine è troppo alto.' }
    const [ordine] = await tx.query<{ id: string }>('insert into ordini(sessione_id,totale_cent) values ($1,$2) returning id',[sessioneId,totale])
    for (const [i,r] of righe.entries()) await tx.query(`insert into righe_ordine(ordine_id,piatto_id,numero,nome,prezzo_unit_cent,quantita,nota,poke,posizione) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,[ordine.id,r.piattoId,r.numero,r.nome,r.prezzoUnitCent,r.quantita,r.nota,r.poke ? JSON.stringify(r.poke) : null,i])
    return { ok: true, ordine: (await leggiOrdini(tx,'o.id=$1',[ordine.id]))[0] }
  })
}
export async function ordiniDellaSessione(db: Db, sessioneId: string): Promise<Ordine[]> {
  return idValido(sessioneId) ? leggiOrdini(db,'o.sessione_id=$1',[sessioneId]) : []
}
export async function ordiniAttivi(db: Db): Promise<Ordine[]> { return leggiOrdini(db,"s.chiusa_il is null and o.stato in ('inviato','in_preparazione')") }
export async function avanzaStato(db: Db, ordineId: string): Promise<Ordine | null> {
  if (!idValido(ordineId)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ stato: StatoOrdineTavolo }>('select stato from ordini where id=$1 for update',[ordineId])
    const stato = o ? prossimoStato(o.stato) : null
    if (!stato) return null
    await tx.query('update ordini set stato=$2,aggiornato_il=now() where id=$1',[ordineId,stato])
    return (await leggiOrdini(tx,'o.id=$1',[ordineId]))[0] ?? null
  })
}
export async function annullaOrdine(db: Db, ordineId: string): Promise<boolean> {
  if (!idValido(ordineId)) return false
  return (await db.query("update ordini set stato='annullato',aggiornato_il=now() where id=$1 and stato in ('inviato','in_preparazione') returning id",[ordineId])).length === 1
}
export async function annullaRiga(db: Db, rigaId: string): Promise<boolean> {
  if (!idValido(rigaId)) return false
  return db.transazione(async tx => {
    // Il lock sull'ordine serializza annullamenti di righe diverse e il ricalcolo.
    const [o] = await tx.query<{ id: string }>(`select o.id from ordini o join righe_ordine r on r.ordine_id=o.id where r.id=$1 and o.stato <> 'annullato' for update of o`,[rigaId])
    if (!o) return false
    const righe = await tx.query('update righe_ordine set annullata=true where id=$1 and not annullata returning id',[rigaId])
    if (!righe.length) return false
    await tx.query(`update ordini set totale_cent=(select coalesce(sum(prezzo_unit_cent*quantita),0)::int from righe_ordine where ordine_id=$1 and not annullata),aggiornato_il=now() where id=$1`,[o.id])
    return true
  })
}
export interface Conto { tavoloNome: string; apertaIl: Date; chiusaIl: Date | null; voci: { nome: string; numero: number | null; quantita: number; importoCent: number }[]; totaleCent: number }
export async function contoSessione(db: Db, sessioneId: string): Promise<Conto | null> {
  if (!idValido(sessioneId)) return null
  const [s] = await db.query<Pick<Conto,'tavoloNome'|'apertaIl'|'chiusaIl'>>(`select t.nome as "tavoloNome",s.aperta_il as "apertaIl",s.chiusa_il as "chiusaIl" from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1`,[sessioneId])
  if (!s) return null
  const voci = await db.query<Conto['voci'][number]>(`select r.nome,r.numero,sum(r.quantita)::int as quantita,sum(r.prezzo_unit_cent::bigint*r.quantita)::float8 as "importoCent"
    from righe_ordine r join ordini o on o.id=r.ordine_id where o.sessione_id=$1 and o.stato <> 'annullato' and not r.annullata
    group by r.numero,r.nome,r.prezzo_unit_cent,r.poke order by r.numero nulls last,r.nome,r.prezzo_unit_cent,r.poke`,[sessioneId])
  return { ...s,voci,totaleCent: voci.reduce((s,r) => s + r.importoCent,0) }
}
