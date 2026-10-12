import type { Db } from '@/server/db-tipi'
import type { Servizio, Turno } from '@/domain/fasce'
import { idValido } from '@/tavoli/validazione'
export interface ImpostazioniCasa { capacitaFascia: number; capacitaConsegne: number; anticipoMinuti: number; telefono: string | null; apertiIl: string | null }
export interface Zona { id: string; nome: string; costoCent: number; minimoCent: number; attiva: boolean; posizione: number }
export type DatiZona = Omit<Zona,'id'>
export interface Orario extends Turno { id: string; servizio: Servizio; giorno: number }
export interface Chiusura { data: string; motivo: string | null }
// date e time arrivano come testo: il driver pg trasformerebbe una date in un Date a mezzanotte locale.
export async function leggiImpostazioni(db: Db): Promise<ImpostazioniCasa> {
  const [i] = await db.query<ImpostazioniCasa>(`select capacita_fascia as "capacitaFascia",capacita_consegne as "capacitaConsegne",anticipo_minuti as "anticipoMinuti",telefono,aperti_il::text as "apertiIl" from impostazioni_casa where id=1`)
  return i
}
export async function salvaImpostazioni(db: Db, i: Omit<ImpostazioniCasa,'apertiIl'>): Promise<void> {
  await db.query('update impostazioni_casa set capacita_fascia=$1,capacita_consegne=$2,anticipo_minuti=$3,telefono=$4 where id=1',[i.capacitaFascia,i.capacitaConsegne,i.anticipoMinuti,i.telefono])
}
/** `data` = giorno (a Roma) in cui gli ordini online sono aperti, oppure null per chiuderli. */
export async function impostaApertura(db: Db, data: string | null): Promise<void> {
  await db.query('update impostazioni_casa set aperti_il=$1::date where id=1',[data])
}
const COLONNE_ZONA = `id,nome,costo_cent as "costoCent",minimo_cent as "minimoCent",attiva,posizione`
export async function elencoZone(db: Db, soloAttive = false): Promise<Zona[]> {
  return db.query<Zona>(`select ${COLONNE_ZONA} from zone_consegna ${soloAttive ? 'where attiva' : ''} order by posizione,nome`)
}
export async function zonaPerId(db: Db, id: string): Promise<Zona | null> {
  if (!idValido(id)) return null
  return (await db.query<Zona>(`select ${COLONNE_ZONA} from zone_consegna where id=$1`,[id]))[0] ?? null
}
export async function creaZona(db: Db, z: DatiZona): Promise<Zona> {
  return (await db.query<Zona>(`insert into zone_consegna (nome,costo_cent,minimo_cent,attiva,posizione) values ($1,$2,$3,$4,$5) returning ${COLONNE_ZONA}`,[z.nome,z.costoCent,z.minimoCent,z.attiva,z.posizione]))[0]
}
export async function salvaZona(db: Db, id: string, z: DatiZona): Promise<boolean> {
  if (!idValido(id)) return false
  return (await db.query('update zone_consegna set nome=$2,costo_cent=$3,minimo_cent=$4,attiva=$5,posizione=$6 where id=$1 returning id',[id,z.nome,z.costoCent,z.minimoCent,z.attiva,z.posizione])).length === 1
}
const COLONNE_ORARIO = `id,servizio,giorno,to_char(dalle,'HH24:MI') as dalle,to_char(alle,'HH24:MI') as alle`
export async function elencoOrari(db: Db): Promise<Orario[]> {
  return db.query<Orario>(`select ${COLONNE_ORARIO} from orari_casa order by giorno,servizio,dalle`)
}
export async function turniDelGiorno(db: Db, servizio: Servizio, giorno: number): Promise<Turno[]> {
  return db.query<Turno>(`select to_char(dalle,'HH24:MI') as dalle,to_char(alle,'HH24:MI') as alle from orari_casa where servizio=$1 and giorno=$2 order by dalle`,[servizio,giorno])
}
export async function aggiungiOrario(db: Db, o: Omit<Orario,'id'>): Promise<void> {
  await db.query('insert into orari_casa (servizio,giorno,dalle,alle) values ($1,$2,$3::time,$4::time)',[o.servizio,o.giorno,o.dalle,o.alle])
}
export async function rimuoviOrario(db: Db, id: string): Promise<boolean> {
  if (!idValido(id)) return false
  return (await db.query('delete from orari_casa where id=$1 returning id',[id])).length === 1
}
/** Chiusure da `daData` in poi (le passate non servono più). */
export async function elencoChiusure(db: Db, daData: string): Promise<Chiusura[]> {
  return db.query<Chiusura>('select data::text as data,motivo from chiusure_casa where data >= $1::date order by data',[daData])
}
export async function chiusoIl(db: Db, data: string): Promise<boolean> {
  return (await db.query('select 1 from chiusure_casa where data=$1::date',[data])).length === 1
}
export async function aggiungiChiusura(db: Db, data: string, motivo: string | null): Promise<void> {
  await db.query('insert into chiusure_casa (data,motivo) values ($1::date,$2) on conflict (data) do update set motivo=excluded.motivo',[data,motivo])
}
export async function rimuoviChiusura(db: Db, data: string): Promise<boolean> {
  return (await db.query('delete from chiusure_casa where data=$1::date returning data',[data])).length === 1
}
/** Vero se tutti i piatti disponibili hanno gli allergeni confermati. */
export async function allergeniCompleti(db: Db): Promise<boolean> {
  const [r] = await db.query<{ completi: boolean }>('select not exists (select 1 from piatti where disponibile and not allergeni_confermati) as completi')
  return r.completi
}
