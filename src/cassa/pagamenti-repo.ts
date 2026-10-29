import type { Db } from '@/server/db-tipi'
import { allaRomana, MAX_PERSONE, metodoValido, quotaPerPiatti, sommaPagati, type GiaPagato, type MetodoPagamento, type PorzioneScelta } from '@/domain/divisione-conto'
import { leggiConto, type Conto } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'

export type ModoPagamento = 'tutto' | 'romana' | 'piatti' | 'importo'
export type RichiestaPagamento =
  | { modo: 'tutto' }
  | { modo: 'romana'; persone: number }
  | { modo: 'importo'; importoCent: number }
  | { modo: 'piatti'; porzioni: PorzioneScelta[]; coperti: number }
/** Dettaglio salvato con i pagamenti «per piatti»: porzioni (con nome e prezzo, per lo scontrino) e coperti. */
export interface DettaglioPiatti { porzioni: (PorzioneScelta & { nome: string; numero: number | null; prezzoUnitCent: number })[]; coperti: number; copertoCent: number }
export type StatoScontrino = 'non_richiesto' | 'in_coda' | 'emesso' | 'errore' | 'incerto' | 'prova'
export interface Pagamento { id: string; importoCent: number; metodo: MetodoPagamento; modo: ModoPagamento; descrizione: string; dettaglio: DettaglioPiatti | null; creatoIl: Date; annullato: boolean
  scontrino: StatoScontrino; scontrinoNumero: string | null; scontrinoErrore: string | null }
/** Di chi è il pagamento: un tavolo (sessione) o un ordine da casa. */
export type Destinazione = { sessioneId: string } | { ordineId: string }
export interface StatoPagamenti { totaleCent: number; pagatoCent: number; residuoCent: number; pagamenti: Pagamento[]; pagato: GiaPagato }
export type EsitoPagamento = { ok: true; pagamento: Pagamento } | { ok: false; errore: string }

const COLONNE = `id,importo_cent as "importoCent",metodo,modo,descrizione,dettaglio,creato_il as "creatoIl",annullato_il is not null as annullato,
  scontrino,scontrino_numero as "scontrinoNumero",scontrino_errore as "scontrinoErrore"`
const NON_VALIDO = { ok: false as const,errore: 'Pagamento non valido.' }

export function richiestaValida(r: unknown): r is RichiestaPagamento {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string,unknown>
  if (x.modo === 'tutto') return true
  if (x.modo === 'romana') return Number.isSafeInteger(x.persone) && (x.persone as number) >= 1 && (x.persone as number) <= MAX_PERSONE
  if (x.modo === 'importo') return Number.isSafeInteger(x.importoCent) && (x.importoCent as number) >= 1
  if (x.modo === 'piatti') return Array.isArray(x.porzioni) && x.porzioni.length <= 200 && Number.isSafeInteger(x.coperti) && (x.coperti as number) >= 0
  return false
}
function destinazioneValida(d: Destinazione): boolean {
  return 'sessioneId' in d ? idValido(d.sessioneId) : idValido(d.ordineId)
}

async function pagamentiValidi(tx: Db, d: Destinazione): Promise<Pagamento[]> {
  const [colonna,id] = 'sessioneId' in d ? ['sessione_id',d.sessioneId] : ['ordine_id',d.ordineId]
  return tx.query<Pagamento>(`select ${COLONNE} from pagamenti where ${colonna}=$1 order by creato_il,id`,[id])
}
function stato(totaleCent: number, pagamenti: Pagamento[]): StatoPagamenti {
  const validi = pagamenti.filter(p => !p.annullato)
  const pagatoCent = validi.reduce((s,p) => s + p.importoCent,0)
  return { totaleCent,pagatoCent,residuoCent: totaleCent - pagatoCent,pagamenti,
    pagato: sommaPagati(validi.flatMap(p => p.dettaglio ? [{ porzioni: p.dettaglio.porzioni,coperti: p.dettaglio.coperti }] : [])) }
}
/** Totale da incassare: il conto del tavolo (coperti compresi) o il totale dell'ordine da casa (0 se annullato o rifiutato). */
async function totaleDi(tx: Db, d: Destinazione, blocca: boolean): Promise<{ totaleCent: number; conto: Conto | null } | null> {
  if ('sessioneId' in d) {
    // Sessione prima di tutto, come chiusura e annullamenti: un annullo in corso aspetta o viene visto.
    if (blocca) await tx.query('select id from sessioni_tavolo where id=$1 for update',[d.sessioneId])
    const conto = await leggiConto(tx,d.sessioneId)
    return conto && { totaleCent: conto.totaleCent,conto }
  }
  const [o] = await tx.query<{ totaleCent: number; stato: string }>(`select totale_cent as "totaleCent",stato from ordini where id=$1 and tipo<>'tavolo' ${blocca ? 'for update' : ''}`,[d.ordineId])
  return o && { totaleCent: ['annullato','rifiutato'].includes(o.stato) ? 0 : o.totaleCent,conto: null }
}

export async function statoPagamenti(db: Db, d: Destinazione): Promise<StatoPagamenti | null> {
  if (!destinazioneValida(d)) return null
  return db.transazione(async tx => {
    const t = await totaleDi(tx,d,false)
    return t && stato(t.totaleCent,await pagamentiValidi(tx,d))
  })
}

/**
 * Registra un incasso. Il server ricalcola l'importo dal conto (mai quello visto dal telefono) e rifiuta
 * ciò che supera il residuo. Il tavolo può essere anche già chiuso: si incassa spesso dopo «Chiudi tavolo».
 */
export async function registraPagamento(db: Db, d: Destinazione, r: RichiestaPagamento, metodo: MetodoPagamento, utenteId: string): Promise<EsitoPagamento> {
  if (!destinazioneValida(d) || !richiestaValida(r) || !metodoValido(metodo) || !idValido(utenteId)) return NON_VALIDO
  if ('ordineId' in d && (r.modo === 'romana' || r.modo === 'piatti')) return NON_VALIDO
  return db.transazione(async tx => {
    const t = await totaleDi(tx,d,true)
    if (!t) return { ok: false,errore: 'Conto non trovato: aggiorna la pagina.' }
    const s = stato(t.totaleCent,await pagamentiValidi(tx,d))
    if (s.residuoCent <= 0) return { ok: false,errore: 'Il conto è già saldato.' }
    let importoCent: number, descrizione: string, dettaglio: DettaglioPiatti | null = null
    if (r.modo === 'tutto') { importoCent = s.residuoCent; descrizione = s.pagatoCent ? 'Saldo' : 'Conto intero' }
    else if (r.modo === 'romana') { importoCent = allaRomana(s.residuoCent,r.persone)[0]; descrizione = r.persone === 1 ? 'Ultima quota alla romana' : `Quota alla romana (1 di ${r.persone})` }
    else if (r.modo === 'importo') { importoCent = r.importoCent; descrizione = 'Importo libero' }
    else {
      const q = quotaPerPiatti(t.conto!.voci,t.conto!,s.pagato,r.porzioni,r.coperti)
      if (!q.ok) return q
      importoCent = q.importoCent; descrizione = 'Per piatti'
      dettaglio = { porzioni: q.porzioni,coperti: q.coperti,copertoCent: t.conto!.copertoCent ?? 0 }
    }
    if (importoCent > s.residuoCent) return { ok: false,errore: 'L’importo supera quanto resta da pagare.' }
    const [colonna,id] = 'sessioneId' in d ? ['sessione_id',d.sessioneId] : ['ordine_id',d.ordineId]
    const [p] = await tx.query<Pagamento>(`insert into pagamenti (${colonna},importo_cent,metodo,modo,descrizione,dettaglio,utente_id) values ($1,$2,$3,$4,$5,$6::text::jsonb,$7) returning ${COLONNE}`,
      [id,importoCent,metodo,r.modo,descrizione,dettaglio ? JSON.stringify(dettaglio) : null,utenteId])
    return { ok: true,pagamento: p }
  })
}

/**
 * Toglie un pagamento registrato per sbaglio: resta nello storico come annullato. Non se il suo scontrino è uscito,
 * in coda o incerto: lo scontrino emesso si annulla sul registratore, non qui.
 */
export async function annullaPagamento(db: Db, id: string, utenteId: string): Promise<'ok' | 'non_disponibile' | 'scontrino'> {
  if (!idValido(id) || !idValido(utenteId)) return 'non_disponibile'
  const [p] = await db.query<{ id: string }>(`update pagamenti set annullato_il=clock_timestamp(),annullato_da=$2
    where id=$1 and annullato_il is null and scontrino in ('non_richiesto','errore','prova') returning id`,[id,utenteId])
  if (p) return 'ok'
  const [x] = await db.query<{ attivo: boolean }>('select annullato_il is null as attivo from pagamenti where id=$1',[id])
  return x?.attivo ? 'scontrino' : 'non_disponibile'
}
