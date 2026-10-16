import type { Db } from '@/server/db-tipi'
import { comandeInCascata, prossimoStatoComanda, statoOrdineDaComande, type StatoComanda, type TipoOrdine } from '@/domain/comande'
import type { OrigineOrdine } from '@/domain/origine-ordine'
import type { Reparto } from '@/domain/reparti'
import { leggiRigheOrdini, type RigaOrdine } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'

// Ordine dei lock, uguale per tutti: sessione → ordine → comande. Le comande si toccano solo
// dopo aver bloccato l'ordine, così la cassa (bottoni a cascata, annullamenti) e i reparti non si incrociano.

/**
 * Una comanda per ogni reparto delle righe appena salvate. Dentro la transazione dell'invio.
 * Da casa niente comanda «sala»: le bevande le mette nel sacchetto la cassa, che porta avanti l'ordine.
 */
export async function creaComande(tx: Db, ordineId: string): Promise<void> {
  await tx.query(`insert into comande (ordine_id,reparto) select distinct r.ordine_id,r.reparto from righe_ordine r join ordini o on o.id=r.ordine_id
    where r.ordine_id=$1 and (o.tipo='tavolo' or r.reparto<>'sala') order by r.reparto`,[ordineId])
}

/** Riallinea ordini.stato alle comande. L'ordine deve essere già bloccato. */
export async function aggiornaStatoOrdine(tx: Db, ordineId: string): Promise<void> {
  const [o] = await tx.query<{ tipo: TipoOrdine; stato: string }>('select tipo,stato from ordini where id=$1',[ordineId])
  if (!o) return
  const stati = (await tx.query<{ stato: StatoComanda }>('select stato from comande where ordine_id=$1',[ordineId])).map(c => c.stato)
  const nuovo = statoOrdineDaComande(o.tipo,o.stato,stati)
  if (nuovo) await tx.query('update ordini set stato=$2,aggiornato_il=clock_timestamp() where id=$1',[ordineId,nuovo])
}

/** Porta le comande dietro a un cambio di stato dell'ordine deciso dalla cassa. L'ordine deve essere già bloccato. */
export async function cascataComande(tx: Db, ordineId: string, statoOrdine: string): Promise<void> {
  const c = comandeInCascata(statoOrdine)
  if (!c) return
  // «Segna servito» della cassa: il tavolo ha già tutto, niente resta da portare.
  await tx.query(`update comande set stato=$3,
      iniziata_il=case when $3 in ('in_preparazione','pronta') then coalesce(iniziata_il,clock_timestamp()) else iniziata_il end,
      pronta_il=case when $3='pronta' then clock_timestamp() else pronta_il end,
      portata_il=case when $4 then coalesce(portata_il,clock_timestamp()) else portata_il end
    where ordine_id=$1 and stato=any($2::text[])`,[ordineId,c.da,c.verso,statoOrdine === 'servito'])
}

/** Comande rimaste senza righe attive (annullamento di righe o voci del conto) → annullate; poi lo stato dell'ordine. */
export async function segnaComandeAnnullate(tx: Db, ordineId: string): Promise<void> {
  await tx.query(`update comande c set stato='annullata' where c.ordine_id=$1 and c.stato<>'annullata'
    and not exists (select 1 from righe_ordine r where r.ordine_id=c.ordine_id and r.reparto=c.reparto and not r.annullata)`,[ordineId])
  await aggiornaStatoOrdine(tx,ordineId)
}

const ORDINE_IN_CUCINA = `('inviato','in_preparazione','accettato')`
type ComandaBloccata = { id: string; ordineId: string; reparto: Reparto; stato: StatoComanda; portata: boolean; tipo: TipoOrdine; statoOrdine: string }
// Ordine prima, comanda dopo.
async function bloccaComanda(tx: Db, id: string): Promise<ComandaBloccata | null> {
  const [c] = await tx.query<{ ordineId: string }>('select ordine_id as "ordineId" from comande where id=$1',[id])
  if (!c) return null
  const [o] = await tx.query<{ tipo: TipoOrdine; stato: string }>('select tipo,stato from ordini where id=$1 for update',[c.ordineId])
  if (!o) return null
  const [b] = await tx.query<Omit<ComandaBloccata,'tipo' | 'statoOrdine'>>('select id,ordine_id as "ordineId",reparto,stato,portata_il is not null as portata from comande where id=$1 for update',[id])
  return b ? { ...b,tipo: o.tipo,statoOrdine: o.stato } : null
}
async function passoComanda(tx: Db, c: ComandaBloccata): Promise<boolean> {
  const verso = prossimoStatoComanda(c.stato,c.reparto)
  if (!verso) return false
  // Le bevande pronte sono già al tavolo: chi le segna è chi le porta.
  await tx.query(`update comande set stato=$2,
      iniziata_il=coalesce(iniziata_il,clock_timestamp()),
      pronta_il=case when $2='pronta' then clock_timestamp() else pronta_il end,
      portata_il=case when $2='pronta' and reparto='sala' then clock_timestamp() else portata_il end
    where id=$1`,[c.id,verso])
  await aggiornaStatoOrdine(tx,c.ordineId)
  return true
}

/** Il reparto porta avanti la sua comanda. `da`: lo stato che vedeva lo schermo; se nel frattempo è cambiato, null. */
export async function avanzaComanda(db: Db, id: string, da: StatoComanda): Promise<true | null> {
  if (!idValido(id)) return null
  return db.transazione(async tx => {
    const c = await bloccaComanda(tx,id)
    if (!c || c.stato !== da || !['inviato','in_preparazione','accettato'].includes(c.statoOrdine)) return null
    return await passoComanda(tx,c) ? true : null
  })
}

/** «Portate» della sala: bevande servite (la comanda diventa pronta) oppure piatti pronti di banco/cucina portati al tavolo. */
export async function portaComanda(db: Db, id: string): Promise<true | null> {
  if (!idValido(id)) return null
  return db.transazione(async tx => {
    const c = await bloccaComanda(tx,id)
    if (!c || c.tipo !== 'tavolo') return null
    if (c.reparto === 'sala') {
      if (!['da_preparare','in_preparazione'].includes(c.stato) || !['inviato','in_preparazione'].includes(c.statoOrdine)) return null
      return await passoComanda(tx,c) ? true : null
    }
    if (c.stato !== 'pronta' || c.portata) return null
    await tx.query('update comande set portata_il=clock_timestamp() where id=$1',[c.id])
    return true
  })
}

export interface ComandaAttiva {
  id: string; reparto: Reparto; stato: StatoComanda; creataIl: Date; ordineId: string; numero: number; tipo: TipoOrdine; origine: OrigineOrdine
  tavoloNome: string | null; tavoloChiuso: boolean; fascia: Date | null; creatoIl: Date; righe: RigaOrdine[]; altreRighe: { reparto: Reparto; n: number }[]
}
export type ComandaClient = Omit<ComandaAttiva,'creataIl' | 'fascia' | 'creatoIl'> & { creataIl: string; fascia: string | null; creatoIl: string }
export function comandaPerClient(c: ComandaAttiva): ComandaClient {
  return { ...c,creataIl: new Date(c.creataIl).toISOString(),creatoIl: new Date(c.creatoIl).toISOString(),fascia: c.fascia ? new Date(c.fascia).toISOString() : null }
}
/** Comande del reparto ancora da fare (o pronte in attesa degli altri reparti), con ordine in cucina. Casa per fascia, tavoli per arrivo. */
export async function comandeAttive(db: Db, reparto: Reparto): Promise<ComandaAttiva[]> {
  const comande = await db.query<Omit<ComandaAttiva,'righe' | 'altreRighe'>>(`select c.id,c.reparto,c.stato,c.creata_il as "creataIl",o.id as "ordineId",o.numero,o.tipo,o.origine,
      t.nome as "tavoloNome",(s.chiusa_il is not null) as "tavoloChiuso",o.fascia,o.creato_il as "creatoIl"
    from comande c join ordini o on o.id=c.ordine_id left join sessioni_tavolo s on s.id=o.sessione_id left join tavoli t on t.id=s.tavolo_id
    where c.reparto=$1 and c.stato in ('da_preparare','in_preparazione','pronta') and o.stato in ${ORDINE_IN_CUCINA}
    order by coalesce(o.fascia,o.creato_il),o.numero`,[reparto])
  if (!comande.length) return []
  const righe = await leggiRigheOrdini(db,comande.map(c => c.ordineId))
  return comande.map(c => {
    const tutte = righe.get(c.ordineId) ?? []
    const altre = new Map<Reparto,number>()
    for (const r of tutte) if (r.reparto !== reparto && !r.annullata) altre.set(r.reparto,(altre.get(r.reparto) ?? 0) + r.quantita)
    return { ...c,righe: tutte.filter(r => r.reparto === reparto),altreRighe: [...altre].map(([reparto,n]) => ({ reparto,n })) }
  })
}

export interface VoceDaPortare { id: string; reparto: Reparto; stato: StatoComanda; ordineId: string; numero: number; tavoloNome: string; quando: Date; righe: RigaOrdine[] }
export type VoceDaPortareClient = Omit<VoceDaPortare,'quando'> & { quando: string }
/** Striscia «Da portare al tavolo»: bevande da servire e piatti pronti di banco e cucina non ancora portati, solo tavoli aperti. */
export async function daPortare(db: Db): Promise<VoceDaPortare[]> {
  const voci = await db.query<Omit<VoceDaPortare,'righe'>>(`select c.id,c.reparto,c.stato,o.id as "ordineId",o.numero,t.nome as "tavoloNome",coalesce(c.pronta_il,c.creata_il) as quando
    from comande c join ordini o on o.id=c.ordine_id join sessioni_tavolo s on s.id=o.sessione_id join tavoli t on t.id=s.tavolo_id
    where o.tipo='tavolo' and s.chiusa_il is null and (
      (c.reparto='sala' and c.stato in ('da_preparare','in_preparazione') and o.stato in ('inviato','in_preparazione'))
      or (c.reparto<>'sala' and c.stato='pronta' and c.portata_il is null and o.stato<>'annullato'))
    order by quando,o.numero,c.reparto`)
  if (!voci.length) return []
  const righe = await leggiRigheOrdini(db,[...new Set(voci.map(v => v.ordineId))])
  return voci.map(v => ({ ...v,righe: (righe.get(v.ordineId) ?? []).filter(r => r.reparto === v.reparto && !r.annullata) }))
}

export interface StatoReparto { reparto: Reparto; stato: StatoComanda; portata: boolean }
/** Stato delle comande per ordine, per i chip della cassa. */
export async function riepilogoComande(db: Db, ordiniIds: string[]): Promise<Map<string,StatoReparto[]>> {
  const per = new Map<string,StatoReparto[]>(ordiniIds.map(id => [id,[]]))
  if (!ordiniIds.length) return per
  const righe = await db.query<StatoReparto & { ordineId: string }>(`select ordine_id as "ordineId",reparto,stato,portata_il is not null as portata from comande
    where ordine_id=any($1::uuid[]) order by case reparto when 'banco' then 0 when 'cucina' then 1 else 2 end`,[ordiniIds])
  for (const { ordineId,...r } of righe) per.get(ordineId)?.push(r)
  return per
}
