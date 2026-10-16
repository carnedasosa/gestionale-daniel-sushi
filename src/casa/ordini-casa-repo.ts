import { randomBytes } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
import { totaliCasa, type CampoCheckout, type DatiCheckout, type Pagamento } from '@/domain/checkout'
import type { Servizio } from '@/domain/fasce'
import type { OrigineOrdine } from '@/domain/origine-ordine'
import { TESTO_MOTIVO } from '@/domain/apertura-casa'
import { formatEuro } from '@/domain/soldi'
import { prossimoStatoCasa, puoAnnullareCasa, STATI_CASA, type StatoCasa } from '@/domain/stati-casa'
import { prezzaRighe, salvaRighe, type RigaOrdine } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
import { leggiDisponibilita } from './disponibilita'

export interface OrdineCasa {
  id: string; numero: number; tipo: Servizio; stato: StatoCasa; token: string; totaleCent: number; consegnaCent: number; fascia: Date; creatoIl: Date; aggiornatoIl: Date
  clienteNome: string | null; clienteTelefono: string | null; clienteEmail: string | null; zonaNome: string | null; indirizzo: string | null; noteConsegna: string | null
  pagamento: Pagamento; contantiDaCent: number | null; motivoRifiuto: string | null; anonimizzato: boolean; origine: OrigineOrdine; righe: RigaOrdine[]
}
export type OrdineCasaClient = Omit<OrdineCasa,'fascia' | 'creatoIl' | 'aggiornatoIl'> & { fascia: string; creatoIl: string; aggiornatoIl: string }
export function perClient(o: OrdineCasa): OrdineCasaClient { return { ...o,fascia: o.fascia.toISOString(),creatoIl: new Date(o.creatoIl).toISOString(),aggiornatoIl: new Date(o.aggiornatoIl).toISOString() } }
export type EsitoCasa = { ok: true; ordine: OrdineCasa } | {
  ok: false; errore: string; campo?: CampoCheckout | 'carrello'; nonDisponibili?: string[]; nonDisponibiliIds?: string[]; totaleCent?: number; fasce?: string[]
}
export const MASSIMO_IN_ATTESA_TELEFONO = 3
export const MASSIMO_ORDINI_RETE_ORA = 10
export function tokenValido(t: unknown): t is string { return typeof t === 'string' && /^[A-Za-z0-9_-]{32}$/.test(t) }
const COLONNE = `o.id,o.numero,o.tipo,o.stato,o.token,o.totale_cent as "totaleCent",o.consegna_cent as "consegnaCent",o.fascia,o.creato_il as "creatoIl",o.aggiornato_il as "aggiornatoIl",
  o.cliente_nome as "clienteNome",o.cliente_telefono as "clienteTelefono",o.cliente_email as "clienteEmail",o.zona_nome as "zonaNome",o.indirizzo,
  o.note_consegna as "noteConsegna",o.pagamento,o.contanti_da_cent as "contantiDaCent",o.motivo_rifiuto as "motivoRifiuto",(o.anonimizzato_il is not null) as anonimizzato,o.origine`
const COLONNE_RIGA = `id,numero,nome,prezzo_unit_cent as "prezzoUnitCent",quantita,nota,poke,annullata`
async function leggiOrdiniCasa(db: Db, condizione: string, parametri: unknown[] = []): Promise<OrdineCasa[]> {
  const ordini = await db.query<Omit<OrdineCasa,'righe'>>(`select ${COLONNE} from ordini o where o.tipo<>'tavolo' and ${condizione} order by o.fascia,o.creato_il,o.numero`,parametri)
  if (!ordini.length) return []
  const righe = await db.query<RigaOrdine & { ordineId: string }>(`select ${COLONNE_RIGA},ordine_id as "ordineId" from righe_ordine where ordine_id=any($1::uuid[]) order by posizione`,[ordini.map(o => o.id)])
  return ordini.map(o => ({ ...o,righe: righe.filter(r => r.ordineId === o.id).map(r => ({ id: r.id,numero: r.numero,nome: r.nome,prezzoUnitCent: r.prezzoUnitCent,quantita: r.quantita,nota: r.nota,poke: r.poke,annullata: r.annullata })) }))
}
export async function ordineCasaPerToken(db: Db, token: string): Promise<OrdineCasa | null> {
  return tokenValido(token) ? (await leggiOrdiniCasa(db,'o.token=$1',[token]))[0] ?? null : null
}
export async function ordineCasaPerId(db: Db, id: string): Promise<OrdineCasa | null> {
  return idValido(id) ? (await leggiOrdiniCasa(db,'o.id=$1',[id]))[0] ?? null : null
}
/** Ordini da accettare e in cucina, in ordine di fascia. */
export async function ordiniCasaAttivi(db: Db): Promise<OrdineCasa[]> {
  return leggiOrdiniCasa(db,"o.stato in ('in_attesa','accettato','in_preparazione','pronto','in_consegna')")
}
async function giaInviato(db: Db, chiave: string): Promise<EsitoCasa | null> {
  const [o] = await db.query<{ id: string; tipo: string }>('select id,tipo from ordini where chiave_invio=$1',[chiave])
  if (!o) return null
  const ordine = o.tipo === 'tavolo' ? null : await ordineCasaPerId(db,o.id)
  return ordine ? { ok: true,ordine } : { ok: false,errore: 'Invio non valido: ricarica la pagina e riprova.' }
}
/** `origine: 'cassa'`: ordine preso a voce dalla cassa, nasce già accettato, senza email né limiti per telefono/rete; `forzaFascia` ammette un orario pieno. */
export interface InputOrdineCasa {
  righe: RigaCarrello[]; dati: DatiCheckout; totaleVistoCent: number; chiaveInvio: string; rete: string | null; adesso: Date; prova: boolean
  origine?: 'cliente' | 'cassa'; forzaFascia?: boolean
}
/** Crea l'ordine in attesa di accettazione (dalla cassa: già accettato). Tutti gli invii da casa si mettono in fila sul lock delle impostazioni. */
export async function creaOrdineCasa(db: Db, input: InputOrdineCasa): Promise<EsitoCasa> {
  const { dati,chiaveInvio } = input
  const cassa = input.origine === 'cassa', forza = cassa && input.forzaFascia === true
  if (!idValido(chiaveInvio)) return { ok: false,errore: 'Chiave di invio non valida: ricarica la pagina e riprova.' }
  if (!Number.isSafeInteger(input.totaleVistoCent)) return { ok: false,errore: 'Totale non valido: ricarica la pagina e riprova.' }
  const carrello = validaCarrello(input.righe)
  if (!carrello.ok) return { ...carrello,campo: 'carrello' }
  try { return await db.transazione(async (tx): Promise<EsitoCasa> => {
    const esistente = await giaInviato(tx,chiaveInvio)
    if (esistente) return esistente
    await tx.query('select id from impostazioni_casa where id=1 for update')
    // Un invio con la stessa chiave può aver concluso mentre aspettavamo il lock.
    const dopoLock = await giaInviato(tx,chiaveInvio)
    if (dopoLock) return dopoLock
    const disponibilita = await leggiDisponibilita(tx,input.adesso,input.prova,cassa ? 'cassa' : 'cliente')
    const servizio = disponibilita.servizi[dati.tipo]
    // Con la forzatura la cassa può ordinare anche se tutte le fasce sono piene, non se il locale è chiuso.
    if (!servizio.apertura.aperto && !(forza && servizio.apertura.motivo === 'fasce')) return { ok: false,errore: TESTO_MOTIVO[servizio.apertura.motivo],campo: 'tipo' }
    const fascia = dati.fascia.toISOString()
    if (!(forza ? servizio.future : servizio.fasce).includes(fascia)) return { ok: false,errore: forza ? 'L’orario scelto è già passato: scegline un altro.' : 'L’orario scelto non è più disponibile: scegline un altro.',campo: 'fascia',fasce: servizio.fasce }
    const zona = dati.tipo === 'domicilio' ? disponibilita.zone.find(z => z.id === dati.zonaId) ?? null : null
    if (dati.tipo === 'domicilio' && !zona) return { ok: false,errore: 'Questa zona non è servita: scegline un’altra.',campo: 'zonaId' }
    if (!cassa) {
      const [{ n: inAttesa }] = await tx.query<{ n: number }>(`select count(*)::int as n from ordini where cliente_telefono=$1 and stato='in_attesa'`,[dati.telefono])
      if (inAttesa >= MASSIMO_IN_ATTESA_TELEFONO) return { ok: false,errore: 'Hai già degli ordini in attesa di conferma: aspetta la nostra risposta o chiamaci.',campo: 'telefono' }
    }
    if (input.rete && !cassa) {
      const [{ n }] = await tx.query<{ n: number }>(`select count(*)::int as n from ordini where rete=$1 and creato_il > $2::timestamptz - interval '1 hour'`,[input.rete,input.adesso])
      if (n >= MASSIMO_ORDINI_RETE_ORA) return { ok: false,errore: 'Troppi ordini da questa connessione: riprova più tardi o chiamaci.' }
    }
    const prezzi = await prezzaRighe(tx,carrello.righe,{ pokeDaCasa: true })
    if (!prezzi.ok) return { ...prezzi,campo: 'carrello' }
    const totali = totaliCasa(prezzi.totaleCent,dati.tipo,zona)
    if (totali.mancanteCent > 0) return { ok: false,errore: `Mancano ${formatEuro(totali.mancanteCent)} per l’ordine minimo di ${zona!.nome}.`,campo: 'carrello' }
    if (totali.totaleCent !== input.totaleVistoCent) return { ok: false,errore: `I prezzi sono cambiati: il totale ora è ${formatEuro(totali.totaleCent)}. Controlla il riepilogo e conferma di nuovo.`,campo: 'carrello',totaleCent: totali.totaleCent }
    if (dati.contantiDaCent !== null && dati.contantiDaCent < totali.totaleCent) return { ok: false,errore: `L’importo in contanti deve coprire il totale di ${formatEuro(totali.totaleCent)}.`,campo: 'contantiDa' }
    const token = randomBytes(24).toString('base64url')
    // Dalla cassa: già accettato, senza consenso privacy (dettato a voce), senza rete e senza email.
    const [ordine] = await tx.query<{ id: string }>(`insert into ordini (tipo,stato,totale_cent,chiave_invio,creato_il,token,fascia,cliente_nome,cliente_telefono,cliente_email,zona_id,zona_nome,consegna_cent,indirizzo,note_consegna,pagamento,contanti_da_cent,privacy_il,rete,origine)
      values ($1,$17,$2,$3,clock_timestamp(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,case when $18::text='cliente' then clock_timestamp() end,$16,$18) returning id`,
    [dati.tipo,totali.totaleCent,chiaveInvio,token,dati.fascia,dati.nome,dati.telefono,dati.email,zona?.id ?? null,zona?.nome ?? null,totali.consegnaCent,dati.indirizzo,dati.noteConsegna,dati.pagamento,dati.contantiDaCent,
      cassa ? null : input.rete,cassa ? 'accettato' : 'in_attesa',cassa ? 'cassa' : 'cliente'])
    await salvaRighe(tx,ordine.id,prezzi.righe)
    if (!cassa) await tx.query(`insert into email_ordini (ordine_id,tipo) values ($1,'ricevuto')`,[ordine.id])
    return { ok: true,ordine: (await ordineCasaPerId(tx,ordine.id))! }
  }) } catch (err) {
    // Due invii con la stessa chiave: il secondo trova l'ordine del primo dopo il rollback.
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      const esistente = await giaInviato(db,chiaveInvio)
      if (esistente) return esistente
    }
    throw err
  }
}
// Ogni cambio di stato parte dallo stato visto dallo staff: un doppio tocco non salta un passaggio.
async function cambiaStato(db: Db, id: string, da: StatoCasa[], verso: (o: { tipo: Servizio; stato: StatoCasa }) => StatoCasa | null, extra: { set?: string; parametri?: unknown[]; email?: 'accettato' | 'rifiutato' | 'annullato' } = {}): Promise<OrdineCasa | null> {
  if (!idValido(id)) return null
  return db.transazione(async tx => {
    const [o] = await tx.query<{ tipo: Servizio; stato: StatoCasa }>(`select tipo,stato from ordini where id=$1 and tipo<>'tavolo' for update`,[id])
    if (!o || !da.includes(o.stato)) return null
    const nuovo = verso(o)
    if (!nuovo) return null
    await tx.query(`update ordini set stato=$2,aggiornato_il=clock_timestamp()${extra.set ? `,${extra.set}` : ''} where id=$1`,[id,nuovo,...(extra.parametri ?? [])])
    // Le email partono solo per gli ordini del cliente: quelli della cassa non hanno indirizzo né consenso.
    if (extra.email) await tx.query(`insert into email_ordini (ordine_id,tipo) select id,$2 from ordini where id=$1 and origine='cliente' on conflict (ordine_id,tipo) do nothing`,[id,extra.email])
    return ordineCasaPerId(tx,id)
  })
}
export async function accettaOrdine(db: Db, id: string, ritardoMinuti: 0 | 15 | 30): Promise<OrdineCasa | null> {
  if (![0,15,30].includes(ritardoMinuti)) return null
  return cambiaStato(db,id,['in_attesa'],() => 'accettato',{ set: `fascia=fascia + make_interval(mins => $3::int)`,parametri: [ritardoMinuti],email: 'accettato' })
}
export async function rifiutaOrdine(db: Db, id: string, motivo: string): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,['in_attesa'],() => 'rifiutato',{ set: 'motivo_rifiuto=$3',parametri: [motivo],email: 'rifiutato' })
}
export async function avanzaOrdineCasa(db: Db, id: string, da: StatoCasa): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,[da],o => prossimoStatoCasa(o.tipo,o.stato))
}
export async function annullaOrdineCasa(db: Db, id: string): Promise<OrdineCasa | null> {
  return cambiaStato(db,id,STATI_CASA.filter(puoAnnullareCasa),() => 'annullato',{ email: 'annullato' })
}
/** Toglie i dati personali dagli ordini da casa più vecchi di 12 mesi. Idempotente. */
export async function anonimizzaOrdiniCasa(db: Db, adesso: Date): Promise<number> {
  return db.transazione(async tx => {
    const ordini = await tx.query<{ id: string }>(`update ordini set cliente_nome=null,cliente_telefono=null,cliente_email=null,indirizzo=null,note_consegna=null,contanti_da_cent=null,rete=null,anonimizzato_il=clock_timestamp()
      where tipo<>'tavolo' and anonimizzato_il is null and creato_il < $1::timestamptz - interval '12 months' returning id`,[adesso])
    if (ordini.length) await tx.query('update righe_ordine set nota=null where ordine_id=any($1::uuid[])',[ordini.map(o => o.id)])
    return ordini.length
  })
}
