import type { Db } from '@/server/db-tipi'
import { chiaveVoce, type MetodoPagamento } from '@/domain/divisione-conto'
import { CATEGORIA_POKE } from '@/domain/reparti'
import type { SceltePoke } from '@/domain/poke'
import { leggiConto } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
import { registraEsito } from '@/stampa/stampe-repo'
import type { EsitoDalPonte } from '@/stampa/ponte'
import type { DettaglioPiatti, ModoPagamento } from '@/cassa/pagamenti-repo'
import { descrizioneRiga, repartoFiscaleValido, righeQuota, totaleRighe, verificaDocumento, type DocumentoCommerciale, type EsitoDocumento, type RigaFiscale } from './documento'
import { leggiRispostaEpson } from './epson'

export interface ImpostazioniFiscali { repartoCoperto: number; repartoConsegna: number; indiceCarta: number; automatico: boolean }
export async function leggiImpostazioniFiscali(db: Db): Promise<ImpostazioniFiscali> {
  return (await db.query<ImpostazioniFiscali>(`select reparto_fiscale_coperto as "repartoCoperto",reparto_fiscale_consegna as "repartoConsegna",indice_carta as "indiceCarta",
    scontrino_automatico as automatico from impostazioni_cassa where id=1`))[0]
}
export async function salvaImpostazioniFiscali(db: Db, i: ImpostazioniFiscali, repartiCategorie: Record<string,number>): Promise<void> {
  await db.transazione(async tx => {
    await tx.query('update impostazioni_cassa set reparto_fiscale_coperto=$1,reparto_fiscale_consegna=$2,indice_carta=$3,scontrino_automatico=$4 where id=1',[i.repartoCoperto,i.repartoConsegna,i.indiceCarta,i.automatico])
    for (const [id,reparto] of Object.entries(repartiCategorie)) await tx.query('update categorie set reparto_fiscale=$2 where id=$1',[id,reparto])
  })
}
export async function repartiFiscaliCategorie(db: Db): Promise<{ id: string; nome: string; repartoFiscale: number }[]> {
  return db.query('select id,nome,reparto_fiscale as "repartoFiscale" from categorie order by posizione')
}

interface VoceFiscale { numero: number | null; nome: string; prezzoUnitCent: number; poke: SceltePoke | null; quantita: number; reparto: number }
// Reparto fiscale della riga: categoria del piatto; la poke composta (senza piatto) quello della categoria delle poke; altrimenti 1.
const REPARTO_RIGA = `coalesce(c.reparto_fiscale,(select reparto_fiscale from categorie where id='${CATEGORIA_POKE}'),1)`
async function vociFiscali(tx: Db, condizione: string, id: string): Promise<VoceFiscale[]> {
  return tx.query<VoceFiscale>(`select r.numero,r.nome,r.prezzo_unit_cent as "prezzoUnitCent",r.poke,sum(r.quantita)::int as quantita,${REPARTO_RIGA} as reparto
    from righe_ordine r join ordini o on o.id=r.ordine_id left join piatti p on p.id=r.piatto_id left join categorie c on c.id=p.categoria_id
    where ${condizione} and o.stato not in ('annullato','rifiutato') and not r.annullata
    group by r.numero,r.nome,r.prezzo_unit_cent,r.poke,${REPARTO_RIGA} order by r.numero nulls last,r.nome,r.prezzo_unit_cent`,[id])
}
const rigaVoce = (v: { numero: number | null; nome: string; prezzoUnitCent: number; reparto: number }, quantita: number): RigaFiscale =>
  ({ descrizione: descrizioneRiga(v.nome,v.numero),quantita,prezzoUnitCent: v.prezzoUnitCent,reparto: v.reparto })
function pesi(righe: RigaFiscale[]): Map<number,number> {
  const m = new Map<number,number>()
  for (const r of righe) m.set(r.reparto,(m.get(r.reparto) ?? 0) + r.quantita * r.prezzoUnitCent)
  return m
}

interface PagamentoFiscale { id: string; sessioneId: string | null; ordineId: string | null; importoCent: number; metodo: MetodoPagamento; modo: ModoPagamento; dettaglio: DettaglioPiatti | null; scontrino: string; annullato: boolean }
/**
 * Righe dello scontrino di un pagamento:
 * - conto intero pagato in una volta, o saldo dopo pagamenti solo «per piatti»: le righe vere (piatto per piatto, coperto, consegna);
 * - «per piatti»: le porzioni e i coperti pagati;
 * - quota alla romana o importo libero: una riga per reparto fiscale, in proporzione al conto.
 */
async function documentoDi(tx: Db, p: PagamentoFiscale, imp: ImpostazioniFiscali): Promise<EsitoDocumento> {
  let tutte: RigaFiscale[], intestazione: string
  const altri = (await tx.query<{ modo: ModoPagamento; dettaglio: DettaglioPiatti | null }>(`select modo,dettaglio from pagamenti where ${p.sessioneId ? 'sessione_id' : 'ordine_id'}=$1 and id<>$2 and annullato_il is null and creato_il<=(select creato_il from pagamenti where id=$2)`,
    [p.sessioneId ?? p.ordineId,p.id]))
  let voci: VoceFiscale[] = [], coperti = 0, copertoCent = 0
  if (p.sessioneId) {
    const conto = await leggiConto(tx,p.sessioneId)
    if (!conto) return { ok: false,errore: 'Conto non trovato.' }
    voci = await vociFiscali(tx,'o.sessione_id=$1',p.sessioneId)
    coperti = conto.coperti ?? 0; copertoCent = conto.copertoCent ?? 0
    tutte = [...voci.map(v => rigaVoce(v,v.quantita)),...(conto.copertiCent ? [{ descrizione: 'Coperto',quantita: coperti,prezzoUnitCent: copertoCent,reparto: imp.repartoCoperto }] : [])]
    intestazione = `Quota conto ${conto.tavoloNome}`
  } else {
    const [o] = await tx.query<{ consegnaCent: number }>('select coalesce(consegna_cent,0) as "consegnaCent" from ordini where id=$1',[p.ordineId])
    voci = await vociFiscali(tx,'o.id=$1',p.ordineId!)
    tutte = [...voci.map(v => rigaVoce(v,v.quantita)),...(o?.consegnaCent ? [{ descrizione: 'Consegna a domicilio',quantita: 1,prezzoUnitCent: o.consegnaCent,reparto: imp.repartoConsegna }] : [])]
    intestazione = 'Quota ordine'
  }
  const documento = (righe: RigaFiscale[]): DocumentoCommerciale => ({ righe,pagamento: { metodo: p.metodo,importoCent: p.importoCent,indice: imp.indiceCarta } })
  const quota = () => verificaDocumento(documento(righeQuota(p.importoCent,pesi(tutte),intestazione)))
  if (p.modo === 'piatti' && p.dettaglio) {
    const perChiave = new Map(voci.map(v => [chiaveVoce(v),v]))
    const righe = p.dettaglio.porzioni.map(x => rigaVoce({ ...x,reparto: perChiave.get(x.chiave)?.reparto ?? 1 },x.quantita))
    if (p.dettaglio.coperti) righe.push({ descrizione: 'Coperto',quantita: p.dettaglio.coperti,prezzoUnitCent: p.dettaglio.copertoCent,reparto: imp.repartoCoperto })
    const e = verificaDocumento(documento(righe))
    return e.ok ? e : quota()
  }
  if (p.modo === 'tutto' && altri.every(a => a.modo === 'piatti' && a.dettaglio)) {
    // Le porzioni già pagate per piatti non si ribattono: restano le righe vere del residuo.
    const pagate = new Map<string,number>(); let copertiPagati = 0
    for (const a of altri) { for (const x of a.dettaglio!.porzioni) pagate.set(x.chiave,(pagate.get(x.chiave) ?? 0) + x.quantita); copertiPagati += a.dettaglio!.coperti }
    const righe: RigaFiscale[] = []
    for (const v of voci) {
      const k = chiaveVoce(v), q = Math.max(0,v.quantita - (pagate.get(k) ?? 0))
      if (q) righe.push(rigaVoce(v,q)); pagate.set(k,Math.max(0,(pagate.get(k) ?? 0) - v.quantita))
    }
    for (const r of tutte.slice(voci.length)) {
      const q = r.descrizione === 'Coperto' ? Math.max(0,coperti - copertiPagati) : r.quantita
      if (q) righe.push({ ...r,quantita: q,prezzoUnitCent: r.descrizione === 'Coperto' ? copertoCent : r.prezzoUnitCent })
    }
    if (totaleRighe(righe) === p.importoCent) return verificaDocumento(documento(righe))
  }
  return quota()
}

export type EsitoScontrino = { ok: true } | { ok: false; errore: string }
/** Accoda lo scontrino di un pagamento al registratore. Mai due volte: solo da «non richiesto» o «errore». */
export async function richiediScontrino(db: Db, pagamentoId: string): Promise<EsitoScontrino> {
  if (!idValido(pagamentoId)) return { ok: false,errore: 'Pagamento non valido.' }
  return db.transazione(async tx => {
    const [rif] = await tx.query<{ sessioneId: string | null; ordineId: string | null }>('select sessione_id as "sessioneId",ordine_id as "ordineId" from pagamenti where id=$1',[pagamentoId])
    if (!rif) return { ok: false,errore: 'Pagamento non trovato.' }
    // Sessione (o ordine) prima del pagamento, come quando si incassa.
    if (rif.sessioneId) await tx.query('select id from sessioni_tavolo where id=$1 for update',[rif.sessioneId])
    else await tx.query('select id from ordini where id=$1 for update',[rif.ordineId])
    const [p] = await tx.query<PagamentoFiscale>(`select id,sessione_id as "sessioneId",ordine_id as "ordineId",importo_cent as "importoCent",metodo,modo,dettaglio,scontrino,annullato_il is not null as annullato
      from pagamenti where id=$1 for update`,[pagamentoId])
    if (p.annullato) return { ok: false,errore: 'Il pagamento è stato tolto.' }
    if (!['non_richiesto','errore'].includes(p.scontrino)) return { ok: false,errore: p.scontrino === 'incerto' ? 'Controlla prima sul registratore se lo scontrino è uscito.' : 'Lo scontrino di questo pagamento è già stato chiesto.' }
    const e = await documentoDi(tx,p,await leggiImpostazioniFiscali(tx))
    if (!e.ok) return e
    await tx.query(`insert into stampe (stampante,tipo,documento,pagamento_id,sessione_id,ordine_id) values ('fiscale','scontrino',$1::text::jsonb,$2,$3,$4)`,[JSON.stringify(e.documento),p.id,p.sessioneId,p.ordineId])
    await tx.query(`update pagamenti set scontrino='in_coda',scontrino_errore=null where id=$1`,[p.id])
    return { ok: true }
  })
}

/** Esito dal ponte: i lavori fiscali qui, gli altri alla coda normale. */
export async function registraEsitoPonte(db: Db, e: EsitoDalPonte): Promise<boolean> {
  if (!idValido(e.id)) return false
  const [l] = await db.query<{ stampante: string }>('select stampante from stampe where id=$1',[e.id])
  if (!l) return false
  if (l.stampante !== 'fiscale') return registraEsito(db,e.id,e.ok ? { ok: true } : { ok: false,errore: e.errore })
  return registraEsitoFiscale(db,e)
}
type StatoScontrino = 'emesso' | 'errore' | 'incerto' | 'prova'
/**
 * Lo scontrino è uscito? Risposta dell'RT letta qui: emesso (con numero e chiusura Z), rifiutato (non uscito: si può
 * rimandare), illeggibile o senza risposta (incerto: decide la cassa guardando l'RT). In prova il ponte risponde «PROVA».
 */
async function registraEsitoFiscale(db: Db, e: EsitoDalPonte): Promise<boolean> {
  return db.transazione(async tx => {
    const [rif] = await tx.query<{ pagamentoId: string }>('select pagamento_id as "pagamentoId" from stampe where id=$1',[e.id])
    await tx.query('select id from pagamenti where id=$1 for update',[rif.pagamentoId])
    const [l] = await tx.query<{ stato: string }>('select stato from stampe where id=$1 for update',[e.id])
    if (l.stato !== 'in_stampa') return false
    let stato: StatoScontrino, dati: { numero?: string | null; data?: string | null; z?: string | null; errore?: string | null } = {}
    if (e.ok && e.risposta === 'PROVA') stato = 'prova'
    else if (e.ok) {
      const r = leggiRispostaEpson(e.risposta ?? '')
      if (r.esito === 'emesso') { stato = 'emesso'; dati = { numero: r.numero,data: r.data,z: r.z } }
      else if (r.esito === 'rifiutato') { stato = 'errore'; dati = { errore: `Il registratore ha rifiutato lo scontrino (codice ${r.codice}).` } }
      else { stato = 'incerto'; dati = { errore: 'Risposta del registratore non leggibile.' } }
    } else if (e.incerto) { stato = 'incerto'; dati = { errore: e.errore } }
    else { stato = 'errore'; dati = { errore: e.errore } }
    const statoLavoro = stato === 'emesso' || stato === 'prova' ? 'stampata' : stato === 'incerto' ? 'incerta' : 'errore'
    await tx.query('update stampe set stato=$2,finita_il=clock_timestamp(),errore=$3 where id=$1',[e.id,statoLavoro,dati.errore?.slice(0,300) ?? null])
    await tx.query(`update pagamenti set scontrino=$2,scontrino_numero=$3,scontrino_data=$4,scontrino_z=$5,scontrino_errore=$6,scontrino_il=case when $2 in ('emesso','prova') then clock_timestamp() end where id=$1`,
      [rif.pagamentoId,stato,dati.numero?.slice(0,20) ?? null,dati.data?.slice(0,20) ?? null,dati.z?.slice(0,20) ?? null,dati.errore?.slice(0,300) ?? null])
    return true
  })
}

/** Scontrino incerto risolto dalla cassa guardando il registratore: uscito (emesso) o no (si potrà rimandare). */
export async function risolviIncerto(db: Db, pagamentoId: string, uscito: boolean): Promise<boolean> {
  if (!idValido(pagamentoId) || typeof uscito !== 'boolean') return false
  return db.transazione(async tx => {
    const [p] = await tx.query(`update pagamenti set scontrino=$2,scontrino_errore=$3,scontrino_il=case when $2='emesso' then clock_timestamp() end where id=$1 and scontrino='incerto' returning id`,
      [pagamentoId,uscito ? 'emesso' : 'errore',uscito ? 'Uscito: confermato dalla cassa sul registratore.' : 'Non uscito: confermato dalla cassa sul registratore.'])
    if (!p) return false
    await tx.query(`update stampe set stato=$2,finita_il=clock_timestamp() where pagamento_id=$1 and stato='incerta'`,[pagamentoId,uscito ? 'stampata' : 'errore'])
    return true
  })
}
export { repartoFiscaleValido }
