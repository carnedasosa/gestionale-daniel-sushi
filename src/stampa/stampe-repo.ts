import type { Db } from '@/server/db-tipi'
import type { TipoOrdine } from '@/domain/comande'
import type { OrigineOrdine } from '@/domain/origine-ordine'
import { REPARTI, type Reparto } from '@/domain/reparti'
import { aggiornaStatoOrdine } from '@/comande/comande-repo'
import { leggiRigheOrdini, type RigaOrdine } from '@/tavoli/ordini-repo'
import { numeroGiorno } from '@/tavoli/numero-giorno'
import { idValido } from '@/tavoli/validazione'
import { leggiImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { bigliettoAnnullo, bigliettoComanda, type DatiComanda } from './biglietti'
import { esitoScadenza, SCADENZA_LAVORO_SECONDI, stampanteDelReparto, TENTATIVI_MASSIMI, type StatoCoda, type Stampante, type TipoLavoro } from './instradamento'
import type { DocumentoStampa } from './documento'

// Ordine dei lock, come nel resto del gestionale: sessione → ordine → comande → stampe.

export interface Lavoro { id: string; stampante: Stampante; tipo: TipoLavoro; documento: unknown; creataIl: Date; pagamentoId: string | null }
interface Testata { tipo: TipoOrdine; origine: OrigineOrdine; numeroGiorno: number; tavoloNome: string | null; clienteNome: string | null; fascia: Date | null; creatoIl: Date }

async function testata(tx: Db, ordineId: string): Promise<Testata | null> {
  return (await tx.query<Testata>(`select o.tipo,o.origine,${numeroGiorno('o')},t.nome as "tavoloNome",o.cliente_nome as "clienteNome",o.fascia,o.creato_il as "creatoIl"
    from ordini o left join sessioni_tavolo s on s.id=o.sessione_id left join tavoli t on t.id=s.tavolo_id where o.id=$1`,[ordineId]))[0] ?? null
}
function datiComanda(t: Testata, reparto: Reparto, righe: RigaOrdine[]): DatiComanda {
  const attive = righe.filter(r => !r.annullata)
  const altre = REPARTI.filter(x => x !== reparto).map(x => ({ reparto: x,n: attive.filter(r => r.reparto === x).reduce((s,r) => s + r.quantita,0) })).filter(a => a.n > 0)
  return { ...t,reparto,righe: attive.filter(r => r.reparto === reparto),altreRighe: altre }
}
async function inserisci(tx: Db, l: { stampante: Stampante; tipo: TipoLavoro; documento: DocumentoStampa; ordineId?: string | null; comandaId?: string | null; sessioneId?: string | null }) {
  await tx.query('insert into stampe (stampante,tipo,documento,ordine_id,comanda_id,sessione_id) values ($1,$2,$3::text::jsonb,$4,$5,$6)',
    [l.stampante,l.tipo,JSON.stringify(l.documento),l.ordineId ?? null,l.comandaId ?? null,l.sessioneId ?? null])
}

/**
 * Accoda le comande dell'ordine per i reparti che lavorano su carta. Va chiamata quando l'ordine entra in preparazione
 * (tavolo all'invio, casa all'accettazione), nella stessa transazione. Senza `ristampa` non accoda due volte la stessa comanda.
 */
export async function accodaComande(tx: Db, ordineId: string, opzioni: { ristampa?: boolean } = {}): Promise<number> {
  const { stampa } = await leggiImpostazioniCassa(tx)
  const comande = await tx.query<{ id: string; reparto: Reparto }>(`select c.id,c.reparto from comande c where c.ordine_id=$1 and c.stato<>'annullata'
    ${opzioni.ristampa ? '' : `and not exists (select 1 from stampe s where s.comanda_id=c.id and s.tipo='comanda')`} order by c.reparto`,[ordineId])
  const daStampare = comande.flatMap(c => { const stampante = stampanteDelReparto(c.reparto,stampa); return stampante ? [{ ...c,stampante }] : [] })
  if (!daStampare.length) return 0
  const t = await testata(tx,ordineId)
  if (!t) return 0
  const righe = (await leggiRigheOrdini(tx,[ordineId])).get(ordineId) ?? []
  let n = 0
  for (const c of daStampare) {
    const d = datiComanda(t,c.reparto,righe)
    if (!d.righe.length) continue
    await inserisci(tx,{ stampante: c.stampante,tipo: 'comanda',documento: bigliettoComanda(d,opzioni),ordineId,comandaId: c.id }); n++
  }
  return n
}

/**
 * Righe tolte da un ordine (o l'ordine intero, `'tutte'`): chiamata dopo l'annullamento, nella stessa transazione.
 * Comanda ancora in coda → si ristampa senza quelle righe (o non si stampa più); già presa dal reparto → biglietto ANNULLATO.
 */
export async function annunciaAnnullo(tx: Db, ordineId: string, righeTolte: string[] | 'tutte', adesso = new Date()): Promise<void> {
  const lavori = await tx.query<{ id: string; stato: string; stampante: Stampante; reparto: Reparto; comandaId: string }>(`select distinct on (c.id) s.id,s.stato,s.stampante,c.reparto,c.id as "comandaId"
    from stampe s join comande c on c.id=s.comanda_id where c.ordine_id=$1 and s.tipo='comanda' order by c.id,s.creata_il desc`,[ordineId])
  if (!lavori.length) return
  const t = await testata(tx,ordineId)
  if (!t) return
  const righe = (await leggiRigheOrdini(tx,[ordineId])).get(ordineId) ?? []
  const tolte = righeTolte === 'tutte' ? righe.filter(r => !r.annullata) : righe.filter(r => righeTolte.includes(r.id))
  for (const l of lavori) {
    const delReparto = tolte.filter(r => r.reparto === l.reparto)
    if (!delReparto.length) continue
    // Nessuno lo ha ancora preso: lo si corregge invece di stampare due biglietti.
    if (l.stato === 'in_coda') {
      const d = datiComanda(t,l.reparto,righeTolte === 'tutte' ? [] : righe)
      if (!d.righe.length) await tx.query(`update stampe set stato='annullata',finita_il=clock_timestamp() where id=$1`,[l.id])
      else await tx.query('update stampe set documento=$2::text::jsonb where id=$1',[l.id,JSON.stringify(bigliettoComanda(d))])
    } else if (l.stato === 'in_stampa' || l.stato === 'stampata') {
      await inserisci(tx,{ stampante: l.stampante,tipo: 'annullo',documento: bigliettoAnnullo({ ...t,reparto: l.reparto,righe: delReparto },adesso),ordineId,comandaId: l.comandaId })
    }
  }
}

/** Ristampa le comande dell'ordine (carta inceppata, biglietto perso). Numero di biglietti accodati. */
export async function ristampaOrdine(db: Db, ordineId: string): Promise<number> {
  if (!idValido(ordineId)) return 0
  return db.transazione(async tx => {
    const [o] = await tx.query('select id from ordini where id=$1 for update',[ordineId])
    return o ? accodaComande(tx,ordineId,{ ristampa: true }) : 0
  })
}

/**
 * Il ponte chiede lavoro: segnale di vita (al più ogni 10 s), poi i lavori scaduti tornano in coda (i fiscali diventano
 * «incerti») e se ne prendono fino a `quanti`, i più vecchi prima. `skip locked`: due ponti accesi non stampano due volte.
 */
export async function prendiLavori(db: Db, quanti = 10): Promise<Lavoro[]> {
  return db.transazione(async tx => {
    await tx.query(`update ponte_stampa set visto_il=clock_timestamp() where id=1 and (visto_il is null or visto_il < clock_timestamp() - interval '10 seconds')`)
    await tx.query(`update stampe set stato=case when stampante='fiscale' then $1 else $2 end where stato='in_stampa' and presa_il < clock_timestamp() - make_interval(secs => $3)`,
      [esitoScadenza('fiscale'),esitoScadenza('cassa'),SCADENZA_LAVORO_SECONDI])
    const presi = await tx.query<Lavoro>(`update stampe set stato='in_stampa',presa_il=clock_timestamp(),tentativi=tentativi+1
      where id in (select id from stampe where stato='in_coda' order by creata_il,id for update skip locked limit $1)
      returning id,stampante,tipo,documento,creata_il as "creataIl",pagamento_id as "pagamentoId"`,[quanti])
    return presi.sort((a,b) => new Date(a.creataIl).getTime() - new Date(b.creataIl).getTime())
  })
}

export type EsitoTrasporto = { ok: true } | { ok: false; errore: string }
/**
 * Esito di un lavoro non fiscale. Riuscito → stampata (e la comanda passa in preparazione); non riuscito → di nuovo in coda,
 * dopo TENTATIVI_MASSIMI in errore. Solo per lavori «in stampa»: un esito arrivato tardi non cambia niente.
 */
export async function registraEsito(db: Db, id: string, esito: EsitoTrasporto): Promise<boolean> {
  if (!idValido(id)) return false
  return db.transazione(async tx => {
    const [rif] = await tx.query<{ ordineId: string | null }>('select ordine_id as "ordineId" from stampe where id=$1',[id])
    if (!rif) return false
    if (rif.ordineId) await tx.query('select id from ordini where id=$1 for update',[rif.ordineId])
    const [l] = await tx.query<{ stato: string; stampante: Stampante; tipo: TipoLavoro; comandaId: string | null; tentativi: number }>(
      'select stato,stampante,tipo,comanda_id as "comandaId",tentativi from stampe where id=$1 for update',[id])
    if (!l || l.stato !== 'in_stampa' || l.stampante === 'fiscale') return false
    if (esito.ok) {
      await tx.query(`update stampe set stato='stampata',finita_il=clock_timestamp(),errore=null where id=$1`,[id])
      if (l.tipo === 'comanda' && l.comandaId && rif.ordineId) await segnaStampata(tx,l.comandaId,rif.ordineId)
    } else {
      await tx.query(`update stampe set stato=$2,errore=$3,finita_il=case when $2='errore' then clock_timestamp() end where id=$1`,
        [id,l.tentativi >= TENTATIVI_MASSIMI ? 'errore' : 'in_coda',esito.errore.slice(0,300)])
    }
    return true
  })
}
/**
 * Comanda arrivata al reparto su carta: passa in preparazione (il cliente vede «In preparazione»). Diventa pronta quando la
 * sala tocca «Portate». L'ordine è già bloccato.
 */
async function segnaStampata(tx: Db, comandaId: string, ordineId: string) {
  await tx.query(`update comande set stampata_il=coalesce(stampata_il,clock_timestamp()),iniziata_il=coalesce(iniziata_il,clock_timestamp()),
    stato=case when stato='da_preparare' then 'in_preparazione' else stato end where id=$1 and stato<>'annullata'`,[comandaId])
  await aggiornaStatoOrdine(tx,ordineId)
}

/** Rimette in coda un lavoro non fiscale finito in errore (stampante sistemata). */
export async function riprovaLavoro(db: Db, id: string): Promise<boolean> {
  if (!idValido(id)) return false
  return (await db.query(`update stampe set stato='in_coda',tentativi=0,errore=null,finita_il=null where id=$1 and stato='errore' and stampante<>'fiscale' returning id`,[id])).length === 1
}

/** Per l'allarme della cassa: errori e incerti delle ultime 12 ore. */
export async function statoCoda(db: Db): Promise<StatoCoda> {
  const [s] = await db.query<StatoCoda>(`select (select visto_il from ponte_stampa where id=1) as "ponteVistoIl",
    count(*) filter (where stato in ('in_coda','in_stampa'))::int as "inCoda",min(creata_il) filter (where stato='in_coda') as "piuVecchia",
    count(*) filter (where stato='errore' and creata_il > now() - interval '12 hours')::int as errori,
    count(*) filter (where stato='incerta' and creata_il > now() - interval '12 hours')::int as incerte from stampe`)
  return s
}
export interface LavoroInErrore { id: string; stampante: Stampante; tipo: TipoLavoro; errore: string | null; creataIl: Date }
export async function lavoriInErrore(db: Db): Promise<LavoroInErrore[]> {
  return db.query<LavoroInErrore>(`select id,stampante,tipo,errore,creata_il as "creataIl" from stampe where stato='errore' and creata_il > now() - interval '12 hours' order by creata_il`)
}
