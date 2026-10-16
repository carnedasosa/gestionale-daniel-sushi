import type { Db } from '@/server/db-tipi'
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { prossimoStato, type StatoOrdineTavolo } from '@/domain/stati-tavolo'
import { puoAnnullareCasa, type StatoCasa } from '@/domain/stati-casa'
import type { OrigineOrdine } from '@/domain/origine-ordine'
import { CATEGORIA_POKE, type Reparto } from '@/domain/reparti'
import { leggiAllergeniPoke, leggiPokeConfig } from './poke-repo'
import { idValido } from './validazione'
import { cascataComande, creaComande, segnaComandeAnnullate } from '@/comande/comande-repo'

export interface RigaOrdine { id: string; numero: number | null; nome: string; prezzoUnitCent: number; quantita: number; nota: string | null; poke: SceltePoke | null; annullata: boolean; reparto: Reparto }
export interface Ordine { id: string; numero: number; stato: StatoOrdineTavolo; totaleCent: number; creatoIl: Date; sessioneId: string; tavoloNome: string; tavoloChiuso: boolean; origine: OrigineOrdine; righe: RigaOrdine[] }
export type OrdineClient = Omit<Ordine,'creatoIl'> & { creatoIl: string }
export type EsitoCreazione = { ok: true; ordine: Ordine } | { ok: false; errore: string; nonDisponibili?: string[]; nonDisponibiliIds?: string[] }
const COLONNE_ORDINE = `o.id,o.numero,o.stato,o.totale_cent as "totaleCent",o.creato_il as "creatoIl",o.sessione_id as "sessioneId",t.nome as "tavoloNome",(s.chiusa_il is not null) as "tavoloChiuso",o.origine`
const COLONNE_RIGA = `id,numero,nome,prezzo_unit_cent as "prezzoUnitCent",quantita,nota,poke,annullata,reparto`
/** Righe degli ordini indicati, raggruppate per ordine e nell'ordine di inserimento: le usano tavoli e ordini da casa. */
export async function leggiRigheOrdini(db: Db, ordiniIds: string[]): Promise<Map<string,RigaOrdine[]>> {
  const per = new Map<string,RigaOrdine[]>(ordiniIds.map(id => [id,[]]))
  if (!ordiniIds.length) return per
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordiniIds])
  for (const { ordineId,...r } of righe) per.get(ordineId)?.push(r)
  return per
}
async function leggiOrdini(db: Db, condizione: string, parametri: unknown[] = []): Promise<Ordine[]> {
  const ordini = await db.query<Omit<Ordine,'righe'>>(`select ${COLONNE_ORDINE} from ordini o join sessioni_tavolo s on s.id=o.sessione_id join tavoli t on t.id=s.tavolo_id where ${condizione} order by o.creato_il,o.numero`,parametri)
  if (!ordini.length) return []
  const righe = await leggiRigheOrdini(db,ordini.map(o => o.id))
  return ordini.map(o => ({ ...o,righe: righe.get(o.id) ?? [] }))
}
export type RigaDaSalvare = Omit<RigaOrdine,'id' | 'annullata'> & { piattoId: string | null }
export type EsitoPrezzi = { ok: true; righe: RigaDaSalvare[]; totaleCent: number } | { ok: false; errore: string; nonDisponibili?: string[]; nonDisponibiliIds?: string[] }
/**
 * Prezzi delle righe ricalcolati dal DB, dentro la transazione dell'invio (piatti e poke restano bloccati fino al commit).
 * `pokeDaCasa`: la poke composta richiede anche gli allergeni degli ingredienti confermati.
 */
export async function prezzaRighe(tx: Db, carrello: RigaCarrello[], { pokeDaCasa = false } = {}): Promise<EsitoPrezzi> {
  const ids = [...new Set(carrello.flatMap(r => r.piattoId ? [r.piattoId] : []))].sort()
  // Il reparto viene dalla categoria e si copia nella riga: un cambio di categoria vale per gli ordini da adesso.
  const piatti = await tx.query<{ id: string; numero: number | null; nome: string; prezzo_cent: number; disponibile: boolean; reparto: Reparto }>('select p.id,p.numero,p.nome,p.prezzo_cent,p.disponibile,c.reparto from piatti p join categorie c on c.id=p.categoria_id where p.id=any($1::uuid[]) order by p.id for share of p',[ids])
  const nonDisponibiliIds = ids.filter(id => !piatti.find(p => p.id === id)?.disponibile)
  const nonDisponibili = nonDisponibiliIds.map(id => piatti.find(p => p.id === id)?.nome ?? 'Piatto non più in menù')
  if (nonDisponibili.length) return { ok: false, errore: 'Alcuni piatti non sono più disponibili', nonDisponibili, nonDisponibiliIds }
  if (carrello.some(r => r.piattoId === null)) await tx.query('select id from poke_config where id=1 for share')
  const config = carrello.some(r => r.piattoId === null) ? await leggiPokeConfig(tx) : null
  if (config && pokeDaCasa && !(await leggiAllergeniPoke(tx,config)).confermati) return { ok: false, errore: 'La poke composta non si può ordinare online in questo momento: rimuovila dal carrello.' }
  const repartoPoke = config ? (await tx.query<{ reparto: Reparto }>('select reparto from categorie where id=$1',[CATEGORIA_POKE]))[0]?.reparto ?? 'banco' : 'banco'
  const righe: RigaDaSalvare[] = []
  for (const r of carrello) {
    if (r.piattoId) {
      const p = piatti.find(p => p.id === r.piattoId)!
      righe.push({ piattoId: p.id, numero: p.numero, nome: p.nome, prezzoUnitCent: p.prezzo_cent, quantita: r.quantita, nota: r.nota || null, poke: null, reparto: p.reparto })
    } else {
      if (!config) return { ok: false, errore: 'La poke composta non è ancora disponibile' }
      const poke = validaPoke(config,r.poke)
      if (!poke.ok) return poke
      righe.push({ piattoId: null, numero: null, nome: 'Poke composta', prezzoUnitCent: poke.prezzoCent, quantita: r.quantita, nota: r.nota || null, poke: poke.scelte, reparto: repartoPoke })
    }
  }
  const totaleCent = righe.reduce((s,r) => s + r.prezzoUnitCent * r.quantita,0)
  if (!Number.isSafeInteger(totaleCent) || totaleCent > 2147483647) return { ok: false, errore: 'Il totale dell’ordine è troppo alto.' }
  return { ok: true, righe, totaleCent }
}
export async function salvaRighe(tx: Db, ordineId: string, righe: RigaDaSalvare[]): Promise<void> {
  for (const [i,r] of righe.entries()) await tx.query(`insert into righe_ordine(ordine_id,piatto_id,numero,nome,prezzo_unit_cent,quantita,nota,poke,posizione,reparto) values ($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9,$10)`,[ordineId,r.piattoId,r.numero,r.nome,r.prezzoUnitCent,r.quantita,r.nota,r.poke ? JSON.stringify(r.poke) : null,i,r.reparto])
}
async function ordineGiaInviato(db: Db,sessioneId: string,key: string): Promise<EsitoCreazione | null> {
  const [o] = await leggiOrdini(db,'o.chiave_invio=$1',[key])
  return o ? o.sessioneId === sessioneId ? { ok: true,ordine: o } : { ok: false,errore: 'Invio non valido: ricarica il carrello e riprova.' } : null
}
/** `origine`: 'cliente' dal telefono al tavolo, 'cameriere' dallo staff loggato che ordina per un tavolo aperto. */
export async function creaOrdineTavolo(db: Db, sessioneId: string, input: RigaCarrello[], chiaveInvio: string, origine: Extract<OrigineOrdine,'cliente' | 'cameriere'> = 'cliente'): Promise<EsitoCreazione> {
  const chiuso = { ok: false as const, errore: 'Il tavolo è stato chiuso: chiedi al personale' }
  if (!idValido(sessioneId)) return chiuso
  if (!idValido(chiaveInvio)) return { ok: false,errore: 'Chiave di invio non valida.' }
  const carrello = validaCarrello(input)
  if (!carrello.ok) return carrello
  try { return await db.transazione(async tx => {
    const esistente = await ordineGiaInviato(tx,sessioneId,chiaveInvio)
    if (esistente) return esistente
    const [s] = await tx.query<{ chiusaIl: Date | null }>(`select s.chiusa_il as "chiusaIl" from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1 and t.attivo for update of s`,[sessioneId])
    // Un altro invio della stessa sessione può aver concluso mentre aspettavamo il lock.
    const dopoLock = await ordineGiaInviato(tx,sessioneId,chiaveInvio)
    if (dopoLock) return dopoLock
    if (!s || s.chiusaIl) return chiuso
    const prezzi = await prezzaRighe(tx,carrello.righe)
    if (!prezzi.ok) return prezzi
    const [ordine] = await tx.query<{ id: string }>('insert into ordini(sessione_id,totale_cent,chiave_invio,origine,creato_il) values ($1,$2,$3,$4,clock_timestamp()) returning id',[sessioneId,prezzi.totaleCent,chiaveInvio,origine])
    await salvaRighe(tx,ordine.id,prezzi.righe)
    await creaComande(tx,ordine.id)
    return { ok: true, ordine: (await leggiOrdini(tx,'o.id=$1',[ordine.id]))[0] }
  }) } catch (err) {
    // Dopo il rollback possiamo rileggere anche il conflitto tra sessioni diverse.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      const esistente = await ordineGiaInviato(db,sessioneId,chiaveInvio)
      if (esistente) return esistente
    }
    throw err
  }
}
export async function ordiniDellaSessione(db: Db, sessioneId: string): Promise<Ordine[]> {
  return idValido(sessioneId) ? leggiOrdini(db,'o.sessione_id=$1',[sessioneId]) : []
}
export async function ordiniAttivi(db: Db): Promise<Ordine[]> { return leggiOrdini(db,"o.stato in ('inviato','in_preparazione')") }
export interface RiepilogoTavolo { sessioneId: string; numeroOrdini: number; totaleCent: number }
export async function riepiloghiTavoli(db: Db): Promise<RiepilogoTavolo[]> {
  return db.query<RiepilogoTavolo>(`select s.id as "sessioneId",count(o.id) filter(where o.stato<>'annullato')::int as "numeroOrdini",
    coalesce(sum(case when o.stato <> 'annullato' then o.totale_cent else 0 end),0)::float8 as "totaleCent"
    from sessioni_tavolo s left join ordini o on o.sessione_id=s.id where s.chiusa_il is null group by s.id`)
}
// `da`: lo stato che vedeva lo staff. Se un altro schermo ha già fatto avanzare la comanda il passo si rifiuta:
// due tocchi su «Inizia a preparare» non la portano a «servito».
export async function avanzaStato(db: Db, ordineId: string, da: StatoOrdineTavolo): Promise<Ordine | null> {
  if (!idValido(ordineId) || !prossimoStato(da)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ stato: StatoOrdineTavolo }>("select stato from ordini where id=$1 and tipo='tavolo' for update",[ordineId])
    if (o?.stato !== da) return null
    await tx.query('update ordini set stato=$2,aggiornato_il=now() where id=$1',[ordineId,prossimoStato(da)])
    // Bottone d'emergenza della cassa: tutte le comande dell'ordine passano insieme.
    await cascataComande(tx,ordineId,prossimoStato(da)!)
    return (await leggiOrdini(tx,'o.id=$1',[ordineId]))[0] ?? null
  })
}
/**
 * Esito di un annullamento: `conto_chiuso` se il tavolo è già stato chiuso (il conto incassato non si tocca più),
 * `ordine_concluso` se l'ordine da casa è già completato (consegnato o ritirato, quindi incassato).
 */
export type EsitoAnnullo = 'ok' | 'conto_chiuso' | 'ordine_concluso' | 'non_disponibile'
// Blocca la sessione prima degli ordini (stesso ordine di chiudiSessione e annullaVoceConto): una chiusura in corso aspetta o viene vista.
async function contoChiuso(tx: Db,sessioneId: string | null): Promise<boolean> {
  if (!sessioneId) return false
  const [s] = await tx.query<{ chiusa: boolean }>('select chiusa_il is not null as chiusa from sessioni_tavolo where id=$1 for share',[sessioneId])
  return !s || s.chiusa
}
type Annullo = { tipo: 'ordine' | 'riga' | 'voce_conto'; ordineId: string; rigaId: string | null; importoCent: number }
async function registraAnnulli(tx: Db,utenteId: string,annulli: Annullo[]) {
  for (const a of annulli) await tx.query('insert into registro_annullamenti(utente_id,tipo,ordine_id,riga_id,importo_cent) values ($1,$2,$3,$4,$5)',[utenteId,a.tipo,a.ordineId,a.rigaId,a.importoCent])
}
export async function annullaOrdine(db: Db, ordineId: string, utenteId: string): Promise<EsitoAnnullo> {
  if (!idValido(ordineId) || !idValido(utenteId)) return 'non_disponibile'
  return db.transazione(async tx => {
    const [s] = await tx.query<{ sessioneId: string }>("select sessione_id as \"sessioneId\" from ordini where id=$1 and tipo='tavolo'",[ordineId])
    if (!s) return 'non_disponibile'
    if (await contoChiuso(tx,s.sessioneId)) return 'conto_chiuso'
    const [o] = await tx.query<{ totaleCent: number }>("update ordini set stato='annullato',aggiornato_il=now() where id=$1 and stato in ('inviato','in_preparazione') returning totale_cent as \"totaleCent\"",[ordineId])
    if (!o) return 'non_disponibile'
    await cascataComande(tx,ordineId,'annullato')
    await registraAnnulli(tx,utenteId,[{ tipo: 'ordine',ordineId,rigaId: null,importoCent: o.totaleCent }])
    return 'ok'
  })
}
export async function annullaRiga(db: Db, rigaId: string, utenteId: string): Promise<EsitoAnnullo> {
  if (!idValido(rigaId) || !idValido(utenteId)) return 'non_disponibile'
  return db.transazione(async tx => {
    const [s] = await tx.query<{ sessioneId: string | null }>('select o.sessione_id as "sessioneId" from ordini o join righe_ordine r on r.ordine_id=o.id where r.id=$1',[rigaId])
    if (!s) return 'non_disponibile'
    // Al tavolo decide la sessione (bloccata prima dell'ordine); da casa sessione_id è null e decide lo stato dell'ordine.
    if (await contoChiuso(tx,s.sessioneId)) return 'conto_chiuso'
    // Il lock sull'ordine serializza annullamenti di righe diverse, i cambi di stato e il ricalcolo: lo stato letto qui è quello aggiornato.
    const [o] = await tx.query<{ id: string; tipo: 'tavolo' | 'asporto' | 'domicilio'; stato: string }>('select o.id,o.tipo,o.stato from ordini o join righe_ordine r on r.ordine_id=o.id where r.id=$1 for update of o',[rigaId])
    if (!o || o.stato === 'annullato') return 'non_disponibile'
    // Da casa una riga si annulla solo dove si annullerebbe l'intero ordine (stessa regola di annullaOrdineCasa).
    if (o.tipo !== 'tavolo' && !puoAnnullareCasa(o.stato as StatoCasa)) return o.stato === 'completato' ? 'ordine_concluso' : 'non_disponibile'
    const [r] = await tx.query<{ importoCent: number }>('update righe_ordine set annullata=true where id=$1 and not annullata returning prezzo_unit_cent*quantita as "importoCent"',[rigaId])
    if (!r) return 'non_disponibile'
    await ricalcolaOrdine(tx,o.id)
    await registraAnnulli(tx,utenteId,[{ tipo: 'riga',ordineId: o.id,rigaId,importoCent: r.importoCent }])
    return 'ok'
  })
}
// Totale = righe attive + consegna (solo domicilio). Senza righe attive l'ordine è annullato; da casa il cliente riceve l'email.
async function ricalcolaOrdine(db: Db,id: string) {
  await db.query(`update ordini set totale_cent=case when r.n=0 then 0 else r.totale+coalesce(ordini.consegna_cent,0) end,stato=case when r.n=0 then 'annullato' else ordini.stato end,aggiornato_il=clock_timestamp() from (select coalesce(sum(prezzo_unit_cent*quantita),0)::int as totale,count(*) as n from righe_ordine where ordine_id=$1 and not annullata) r where ordini.id=$1`,[id])
  await segnaComandeAnnullate(db,id)
  await db.query(`insert into email_ordini (ordine_id,tipo) select id,'annullato' from ordini where id=$1 and tipo<>'tavolo' and origine='cliente' and stato='annullato' on conflict (ordine_id,tipo) do nothing`,[id])
}
export interface IdentitaVoce { nome: string; numero: number | null; prezzoUnitCent: number; poke: SceltePoke | null }
export async function annullaVoceConto(db: Db,sessioneId: string,v: IdentitaVoce,utenteId: string): Promise<EsitoAnnullo> {
  if (!idValido(sessioneId) || !idValido(utenteId) || !v || typeof v.nome !== 'string' || !v.nome.length || v.nome.length>300 || !Number.isSafeInteger(v.prezzoUnitCent) || v.prezzoUnitCent<0 || v.prezzoUnitCent>2147483647 || (v.numero!==null && (!Number.isSafeInteger(v.numero) || v.numero<0 || v.numero>2147483647)) || (v.poke!==null && (typeof v.poke!=='object' || Array.isArray(v.poke) || !Object.values(v.poke).every(x => Array.isArray(x) && x.every(s => typeof s==='string'))))) return 'non_disponibile'
  return db.transazione(async tx => {
    const [s] = await tx.query<{ chiusa: boolean }>('select chiusa_il is not null as chiusa from sessioni_tavolo where id=$1 for update',[sessioneId])
    if (!s) return 'non_disponibile'
    if (s.chiusa) return 'conto_chiuso'
    const ordini = await tx.query<{ id: string }>("select id from ordini where sessione_id=$1 and stato<>'annullato' order by id for update",[sessioneId])
    const righe = await tx.query<{ id: string; ordineId: string; importoCent: number }>(`update righe_ordine set annullata=true where ordine_id=any($1::uuid[]) and not annullata and nome=$2 and numero is not distinct from $3::int and prezzo_unit_cent=$4 and poke is not distinct from $5::text::jsonb returning id,ordine_id as "ordineId",prezzo_unit_cent*quantita as "importoCent"`,[ordini.map(o => o.id),v.nome,v.numero,v.prezzoUnitCent,v.poke===null ? null : JSON.stringify(v.poke)])
    for (const id of new Set(righe.map(r => r.ordineId))) await ricalcolaOrdine(tx,id)
    await registraAnnulli(tx,utenteId,righe.map(r => ({ tipo: 'voce_conto',ordineId: r.ordineId,rigaId: r.id,importoCent: r.importoCent })))
    return righe.length>0 ? 'ok' : 'non_disponibile'
  })
}
// ordiniIds: ordini non annullati del conto, per riconoscere quelli arrivati dopo l'apertura della pagina.
export interface Conto { tavoloNome: string; apertaIl: Date; chiusaIl: Date | null; vistoAlle: Date; voci: (IdentitaVoce & { quantita: number; importoCent: number })[]; totaleCent: number; ordiniIds: string[] }
export async function contoSessione(db: Db, sessioneId: string): Promise<Conto | null> {
  if (!idValido(sessioneId)) return null
  return db.transazione(async tx => {
  const [s] = await tx.query<Pick<Conto,'tavoloNome'|'apertaIl'|'chiusaIl'>>(`select t.nome as "tavoloNome",s.aperta_il as "apertaIl",s.chiusa_il as "chiusaIl" from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where s.id=$1 for share of s`,[sessioneId])
  if (!s) return null
  const [{ vistoAlle }] = await tx.query<{ vistoAlle: Date }>('select clock_timestamp() as "vistoAlle"')
  const voci = await tx.query<Conto['voci'][number]>(`select r.nome,r.numero,r.prezzo_unit_cent as "prezzoUnitCent",r.poke,sum(r.quantita)::int as quantita,sum(r.prezzo_unit_cent::bigint*r.quantita)::float8 as "importoCent"
    from righe_ordine r join ordini o on o.id=r.ordine_id where o.sessione_id=$1 and o.stato <> 'annullato' and not r.annullata
    group by r.numero,r.nome,r.prezzo_unit_cent,r.poke order by r.numero nulls last,r.nome,r.prezzo_unit_cent,r.poke`,[sessioneId])
  const ordini = await tx.query<{ id: string }>("select id from ordini where sessione_id=$1 and stato<>'annullato' order by creato_il,id",[sessioneId])
  return { ...s,vistoAlle,voci,totaleCent: voci.reduce((s,r) => s + r.importoCent,0),ordiniIds: ordini.map(o => o.id) }
  })
}
