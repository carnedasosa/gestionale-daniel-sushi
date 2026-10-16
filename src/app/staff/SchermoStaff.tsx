'use client'
import Link from 'next/link'
import { useContext, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro } from '@/domain/soldi'
import { etichettaOrigine } from '@/domain/origine-ordine'
import { arriviCucina, leggiStatoArrivi, segnaLetto, type StatoArrivi } from '@/domain/arrivi-cucina'
import type { OrdineClient, RiepilogoTavolo } from '@/tavoli/ordini-repo'
import type { TavoloConSessione, ContoRecente } from '@/tavoli/repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { AltreAzioni } from '@/componenti/AltreAzioni'
import { SuonoTurno } from './InizioTurno'
import { BarraStaff } from './BarraStaff'
import { ElencoConti } from './ElencoConti'
import { VistaTavoli } from './VistaTavoli'
import { MenuStaff } from './MenuStaff'
import type { CategoriaElenco } from '@/menu/elenco'
import { CardOrdineCasa, OrdiniOnlineBarra, type OrdiniOnline } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { colonnaCucina } from '@/domain/stati-casa'
import type { VistaStaff } from './vista'
import { avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, type EsitoStaff } from './azioni'

type Esegui = (azione: () => Promise<EsitoStaff>) => void
export type TavoloStaff = Omit<TavoloConSessione,'sessione'> & { sessione: (Omit<NonNullable<TavoloConSessione['sessione']>,'apertaIl'> & { apertaIl: string }) | null }
// Letta al clic (anche sul bottone, che arriva prima): alla pressione l’etichetta «Nuovo ordine» sparirebbe e sposterebbe il bottone sotto il dito.
export function CardOrdine({ ordine: o,ora,nuovo,inCorso,leggi,esegui }: { ordine: OrdineClient; ora: string; nuovo: boolean; inCorso: boolean; leggi: () => void; esegui: Esegui }) {
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(o.creatoIl).getTime()) / 60000))
  return <article className={`b-comanda${nuovo ? ' b-comanda--nuovo' : ''}${o.stato === 'in_preparazione' ? ' b-comanda--preparazione' : ''}`} onClick={leggi}>
    <div className="b-comanda__testa">
      <h3 className="b-comanda__titolo"><span className="b-comanda__nome">{o.tavoloNome}</span> <span className="b-num b-comanda__numero">· n. {o.numero}</span></h3>
      <span className="b-num b-comanda__timer" aria-label={`${minuti} min`}>{minuti}′</span>
    </div>
    {(nuovo || etichettaOrigine(o.origine)) && <div className="b-comanda__etichette">{nuovo && <span className="b-etichetta b-etichetta--accettare">Nuovo ordine</span>}{etichettaOrigine(o.origine) && <span className="b-etichetta">{etichettaOrigine(o.origine)}</span>}</div>}
    <p className="b-comanda__meta b-num">{formatEuro(o.totaleCent)}</p>
    {o.tavoloChiuso && <p className="b-nota">Tavolo chiuso</p>}
    <DettaglioRighe righe={o.righe} area="staff" perReparto />
    <div className="b-comanda__azioni">
      <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => { leggi(); esegui(() => avanzaOrdine(o.id,o.stato)) }}>{o.stato === 'inviato' ? 'Inizia a preparare' : 'Segna servito'}</button>
      <AltreAzioni titolo={`Altre azioni · ${o.tavoloNome} n. ${o.numero}`}>{chiudi => <>
        {nuovo && <button type="button" className="b-btn b-btn--secondario" onClick={() => { leggi(); chiudi() }}>Segna come letto</button>}
        {/* Il conto di un tavolo chiuso è già stato incassato: niente annullamenti, il server li rifiuterebbe. */}
        {o.tavoloChiuso ? <p className="b-secondario">Tavolo chiuso: il conto non si può più modificare.</p> : <>
          {o.righe.filter(r => !r.annullata).map(r => <ConfermaAzione key={r.id} inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => { chiudi(); esegui(() => annullaRigaStaff(r.id)) }}>Annulla {r.nome}</ConfermaAzione>)}
          <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}?`} conferma={() => { chiudi(); esegui(() => annullaOrdineStaff(o.id)) }}>Annulla tutto l’ordine</ConfermaAzione>
        </>}
      </>}</AltreAzioni>
    </div>
  </article>
}
export interface DatiStaff { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[]; casa: OrdineCasaClient[]; ordiniOnline: OrdiniOnline; menu?: CategoriaElenco[] | null }
const CHIAVE_ARRIVI = 'ds_arrivi_cucina'
function arriviSalvati(): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(CHIAVE_ARRIVI)) } catch { return null }
}
function salvaArrivi(stato: StatoArrivi) {
  try { sessionStorage.setItem(CHIAVE_ARRIVI,JSON.stringify(stato)) } catch { /* Senza storage la memoria resta solo in questa pagina. */ }
}
const COLONNE = [
  { chiave: 'da_preparare',titolo: 'Da preparare',punto: '' },
  { chiave: 'in_preparazione',titolo: 'In preparazione',punto: 'b-punto--preparazione' },
  { chiave: 'pronti',titolo: 'Pronti e in consegna',punto: 'b-punto--pronto' },
] as const
// Le tre schede restano tutte montate (si nasconde quella non scelta): suono e memoria degli ordini letti valgono ovunque.
export function SchermoStaff({ dati,ora,vista = 'ordini',uscita }: { dati: DatiStaff | null; ora: string; vista?: VistaStaff; uscita?: React.ReactNode }) {
  // Se una lettura dal database fallisce lo schermo resta montato con gli ultimi dati ricevuti:
  // smontarlo azzererebbe il suono e la memoria degli ordini già visti.
  const [ultimi,setUltimi] = useState(dati)
  if (dati && dati !== ultimi) setUltimi(dati)
  const mostrati = dati ?? ultimi
  const ordini = mostrati?.ordini
  const [errore,setErrore] = useState<string | null>(null)
  const [nuovi,setNuovi] = useState<string[]>([])
  // undefined = non ancora letto da sessionStorage; null = primo avvio del turno in questa scheda.
  const arrivi = useRef<StatoArrivi | null | undefined>(undefined)
  const [inCorso,startTransition] = useTransition()
  const bloccato = useRef(false)
  const router = useRouter(), suona = useContext(SuonoTurno)
  useEffect(() => {
    if (!ordini) return
    if (arrivi.current === undefined) arrivi.current = arriviSalvati()
    const { stato,arrivati } = arriviCucina(arrivi.current,ordini.map(o => o.id))
    arrivi.current = stato; salvaArrivi(stato)
    setNuovi(stato.nuovi)
    if (arrivati.length) suona(3)
  },[ordini,suona])
  const leggi = (id: string) => {
    if (!arrivi.current) return
    arrivi.current = segnaLetto(arrivi.current,id); salvaArrivi(arrivi.current)
    setNuovi(arrivi.current.nuovi)
  }
  const esegui: Esegui = azione => {
    if (bloccato.current) return
    bloccato.current = true; setErrore(null)
    startTransition(async () => {
      try { const esito = await azione(); if (!esito.ok) setErrore(esito.errore ?? 'Operazione non riuscita, riprova.'); router.refresh() }
      catch { setErrore('Operazione non riuscita, riprova.') }
      finally { bloccato.current = false }
    })
  }
  // Suono ripetuto ogni 10 secondi finché c'è un ordine da casa da accettare; subito quando ne arriva uno nuovo.
  const inAttesa = (mostrati?.casa ?? []).filter(o => o.stato === 'in_attesa').map(o => o.id).join(',')
  useEffect(() => {
    if (!inAttesa) return
    suona(3)
    const timer = setInterval(() => suona(3),10000)
    return () => clearInterval(timer)
  },[inAttesa,suona])
  if (!mostrati || !ordini) return <><BarraStaff vista={vista} daGuardare={0} online={null} ora={ora} /><p role="status" className="b-staff__vuoto">Caricamento dello schermo…</p>{uscita}</>
  const { tavoli,riepiloghi,contiRecenti,casa,ordiniOnline } = mostrati
  const daAccettare = casa.filter(o => o.stato === 'in_attesa')
  // Tavoli e casa nella stessa cucina: la casa per orario della fascia, i tavoli per arrivo.
  const cucina = [...ordini.map(o => ({ casa: false as const,o,quando: o.creatoIl })),...casa.filter(o => colonnaCucina(o.stato)).map(o => ({ casa: true as const,o,quando: o.fascia }))]
    .sort((a,b) => a.quando.localeCompare(b.quando))
  const aperti = tavoli.filter(t => t.sessione).map(t => ({ id: t.sessione!.id,nome: t.nome,totaleCent: riepiloghi.find(r => r.sessioneId === t.sessione!.id)?.totaleCent ?? 0 }))
  return <>
    <BarraStaff vista={vista} daGuardare={daAccettare.length + nuovi.length} ora={ora} azioni={<Link href="/staff/nuovo-ordine" className="b-staff-barra__bottone">Nuovo ordine</Link>}
      online={<OrdiniOnlineBarra stato={ordiniOnline} inCorso={inCorso} esegui={esegui} uscita={uscita} />} />
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo b-staff__avviso">{errore}</p>}
    <section aria-label="Ordini" hidden={vista !== 'ordini'} className="b-staff__vista">
      <div className="b-colonne">
        <section className="b-colonna" aria-labelledby="col-accettare">
          <h2 id="col-accettare" className="b-colonna__titolo"><span className="b-punto b-punto--accettare" aria-hidden="true" />Da accettare <span className="b-num b-secondario">{daAccettare.length}</span></h2>
          {!daAccettare.length && <p className="b-secondario">Nessun ordine da accettare.</p>}
          {daAccettare.map(o => <CardOrdineCasa key={o.id} ordine={o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare />)}
        </section>
        {COLONNE.map(col => { const qui = cucina.filter(x => colonnaCucina(x.o.stato) === col.chiave)
          return <section key={col.chiave} className="b-colonna" aria-labelledby={`col-${col.chiave}`}>
            <h2 id={`col-${col.chiave}`} className="b-colonna__titolo"><span className={`b-punto ${col.punto}`} aria-hidden="true" />{col.titolo} <span className="b-num b-secondario">{qui.length}</span></h2>
            {!qui.length && <p className="b-secondario">Nessun ordine.</p>}
            {qui.map(x => x.casa ? <CardOrdineCasa key={x.o.id} ordine={x.o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare={false} />
              : <CardOrdine key={x.o.id} ordine={x.o} ora={ora} nuovo={nuovi.includes(x.o.id)} inCorso={inCorso} leggi={() => leggi(x.o.id)} esegui={esegui} />)}
          </section> })}
      </div>
    </section>
    <section aria-label="Tavoli" hidden={vista !== 'tavoli'} className="b-staff__vista">
      <VistaTavoli tavoli={tavoli} riepiloghi={riepiloghi} ordini={ordini} inCorso={inCorso} esegui={esegui} />
    </section>
    <section aria-label="Conti" hidden={vista !== 'conti'} className="b-staff__vista">
      <div className="b-conti"><ElencoConti aperti={aperti} recenti={contiRecenti.map(c => ({ id: c.id,nome: c.tavoloNome,chiusaIl: c.chiusaIl }))} corrente={null} />
        <p className="b-conti__vuoto b-secondario">Scegli un tavolo per vedere il conto.</p></div>
    </section>
    <section aria-label="Menù" hidden={vista !== 'menu'} className="b-staff__vista">
      {vista === 'menu' && <MenuStaff categorie={mostrati.menu ?? null} />}
    </section>
  </>
}
