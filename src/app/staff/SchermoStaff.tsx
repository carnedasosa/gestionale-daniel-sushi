'use client'
import Link from 'next/link'
import { useContext, useEffect } from 'react'
import { formatEuro } from '@/domain/soldi'
import { etichettaOrigine } from '@/domain/origine-ordine'
import { nuovoOrdineAmmesso, onlineAmmesso, suonaAccettare, type Postazione } from '@/domain/postazioni'
import type { StatoReparto, VoceDaPortareClient } from '@/comande/comande-repo'
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
import { avanzaOrdine, annullaOrdineStaff, annullaRigaStaff } from './azioni'
import { ChipComande, DaPortare } from './DaPortare'
import { useArrivi } from './useArrivi'
import { useEsegui, useUltimiDati, type Esegui } from './useEsegui'

export type TavoloStaff = Omit<TavoloConSessione,'sessione'> & { sessione: (Omit<NonNullable<TavoloConSessione['sessione']>,'apertaIl'> & { apertaIl: string }) | null }
// Letta al clic (anche sul bottone, che arriva prima): alla pressione l’etichetta «Nuovo ordine» sparirebbe e sposterebbe il bottone sotto il dito.
export function CardOrdine({ ordine: o,ora,nuovo,inCorso,leggi,esegui,comande }: { ordine: OrdineClient; ora: string; nuovo: boolean; inCorso: boolean; leggi: () => void; esegui: Esegui; comande?: StatoReparto[] }) {
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(o.creatoIl).getTime()) / 60000))
  return <article className={`b-comanda${nuovo ? ' b-comanda--nuovo' : ''}${o.stato === 'in_preparazione' ? ' b-comanda--preparazione' : ''}`} onClick={leggi}>
    <div className="b-comanda__testa">
      <h3 className="b-comanda__titolo"><span className="b-comanda__nome">{o.tavoloNome}</span> <span className="b-num b-comanda__numero">· n. {o.numeroGiorno}</span></h3>
      <span className="b-num b-comanda__timer" aria-label={`${minuti} min`}>{minuti}′</span>
    </div>
    {(nuovo || etichettaOrigine(o.origine)) && <div className="b-comanda__etichette">{nuovo && <span className="b-etichetta b-etichetta--accettare">Nuovo ordine</span>}{etichettaOrigine(o.origine) && <span className="b-etichetta">{etichettaOrigine(o.origine)}</span>}</div>}
    <ChipComande comande={comande} />
    <p className="b-comanda__meta b-num">{formatEuro(o.totaleCent)}</p>
    {o.tavoloChiuso && <p className="b-nota">Tavolo chiuso</p>}
    <DettaglioRighe righe={o.righe} area="staff" perReparto />
    <div className="b-comanda__azioni">
      <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => { leggi(); esegui(() => avanzaOrdine(o.id,o.stato)) }}>{o.stato === 'inviato' ? 'Inizia a preparare' : 'Segna servito'}</button>
      <AltreAzioni titolo={`Altre azioni · ${o.tavoloNome} n. ${o.numeroGiorno}`}>{chiudi => <>
        {nuovo && <button type="button" className="b-btn b-btn--secondario" onClick={() => { leggi(); chiudi() }}>Segna come letto</button>}
        {/* Il conto di un tavolo chiuso è già stato incassato: niente annullamenti, il server li rifiuterebbe. */}
        {o.tavoloChiuso ? <p className="b-secondario">Tavolo chiuso: il conto non si può più modificare.</p> : <>
          {o.righe.filter(r => !r.annullata).map(r => <ConfermaAzione key={r.id} inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => { chiudi(); esegui(() => annullaRigaStaff(r.id)) }}>Annulla {r.nome}</ConfermaAzione>)}
          <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numeroGiorno}?`} conferma={() => { chiudi(); esegui(() => annullaOrdineStaff(o.id)) }}>Annulla tutto l’ordine</ConfermaAzione>
        </>}
      </>}</AltreAzioni>
    </div>
  </article>
}
export interface DatiStaff {
  tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[]; casa: OrdineCasaClient[]; ordiniOnline: OrdiniOnline; menu?: CategoriaElenco[] | null
  daPortare?: VoceDaPortareClient[]; comande?: Record<string,StatoReparto[]>
}
const COLONNE = [
  { chiave: 'da_preparare',titolo: 'Da preparare',punto: '' },
  { chiave: 'in_preparazione',titolo: 'In preparazione',punto: 'b-punto--preparazione' },
  { chiave: 'pronti',titolo: 'Pronti e in consegna',punto: 'b-punto--pronto' },
] as const
// Le schede restano tutte montate (si nasconde quella non scelta): suono e memoria degli ordini letti valgono ovunque.
// `postazione`: cassa (tutto) o sala (telefoni dei camerieri: niente interruttore online, «Nuovo ordine» né suono per gli ordini da accettare).
export function SchermoStaff({ dati,ora,vista = 'ordini',uscita,postazione = 'cassa' }: { dati: DatiStaff | null; ora: string; vista?: VistaStaff; uscita?: React.ReactNode; postazione?: Extract<Postazione,'cassa' | 'sala'> }) {
  // Se una lettura dal database fallisce lo schermo resta montato con gli ultimi dati ricevuti:
  // smontarlo azzererebbe il suono e la memoria degli ordini già visti.
  const mostrati = useUltimiDati(dati)
  const ordini = mostrati?.ordini
  const suona = useContext(SuonoTurno)
  // «In corso» per card: un'azione lenta (o il suo aggiornamento) non blocca le altre card.
  const { azioniDi,errore } = useEsegui()
  // Ordini al tavolo nuovi: evidenziati finché non si toccano. Suonano le cose da portare al tavolo.
  const { nuovi,leggi } = useArrivi(`ds_arrivi_${postazione}`,ordini?.map(o => o.id),() => {})
  const { nuovi: nuoviDaPortare } = useArrivi(`ds_arrivi_portare_${postazione}`,mostrati?.daPortare?.map(v => v.id),() => suona(3))
  // Suono ripetuto ogni 10 secondi finché c'è un ordine da casa da accettare; subito quando ne arriva uno nuovo.
  const inAttesa = suonaAccettare(postazione) ? (mostrati?.casa ?? []).filter(o => o.stato === 'in_attesa').map(o => o.id).join(',') : ''
  useEffect(() => {
    if (!inAttesa) return
    suona(3)
    const timer = setInterval(() => suona(3),10000)
    return () => clearInterval(timer)
  },[inAttesa,suona])
  if (!mostrati || !ordini) return <><BarraStaff postazione={postazione} vista={vista} daGuardare={0} online={null} ora={ora} uscita={uscita} /><p role="status" className="b-staff__vuoto">Caricamento dello schermo…</p></>
  const { tavoli,riepiloghi,contiRecenti,casa,ordiniOnline } = mostrati
  const comande = mostrati.comande ?? {}
  const daAccettare = casa.filter(o => o.stato === 'in_attesa')
  // Tavoli e casa nella stessa cucina: la casa per orario della fascia, i tavoli per arrivo.
  const cucina = [...ordini.map(o => ({ casa: false as const,o,quando: o.creatoIl })),...casa.filter(o => colonnaCucina(o.stato)).map(o => ({ casa: true as const,o,quando: o.fascia }))]
    .sort((a,b) => a.quando.localeCompare(b.quando))
  const aperti = tavoli.filter(t => t.sessione).map(t => ({ id: t.sessione!.id,nome: t.nome,totaleCent: riepiloghi.find(r => r.sessioneId === t.sessione!.id)?.totaleCent ?? 0 }))
  return <>
    <BarraStaff postazione={postazione} vista={vista} daGuardare={daAccettare.length + nuovi.length + nuoviDaPortare.length} ora={ora} uscita={uscita}
      azioni={nuovoOrdineAmmesso(postazione) ? <Link href="/staff/nuovo-ordine" className="b-staff-barra__bottone">Nuovo ordine</Link> : null}
      online={onlineAmmesso(postazione) ? <OrdiniOnlineBarra stato={ordiniOnline} {...azioniDi('ordini-online')} uscita={uscita} /> : null} />
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo b-staff__avviso">{errore}</p>}
    <section aria-label="Ordini" hidden={vista !== 'ordini'} className="b-staff__vista">
      <DaPortare voci={mostrati.daPortare ?? []} nuove={nuoviDaPortare} azioniDi={azioniDi} />
      <div className="b-colonne">
        <section className="b-colonna" aria-labelledby="col-accettare">
          <h2 id="col-accettare" className="b-colonna__titolo"><span className="b-punto b-punto--accettare" aria-hidden="true" />Da accettare <span className="b-num b-secondario">{daAccettare.length}</span></h2>
          {!daAccettare.length && <p className="b-secondario">Nessun ordine da accettare.</p>}
          {daAccettare.map(o => <CardOrdineCasa key={o.id} ordine={o} ora={ora} {...azioniDi(`casa:${o.id}`)} daAccettare comande={comande[o.id]} />)}
        </section>
        {COLONNE.map(col => { const qui = cucina.filter(x => colonnaCucina(x.o.stato) === col.chiave)
          return <section key={col.chiave} className="b-colonna" aria-labelledby={`col-${col.chiave}`}>
            <h2 id={`col-${col.chiave}`} className="b-colonna__titolo"><span className={`b-punto ${col.punto}`} aria-hidden="true" />{col.titolo} <span className="b-num b-secondario">{qui.length}</span></h2>
            {!qui.length && <p className="b-secondario">Nessun ordine.</p>}
            {qui.map(x => x.casa ? <CardOrdineCasa key={x.o.id} ordine={x.o} ora={ora} {...azioniDi(`casa:${x.o.id}`)} daAccettare={false} comande={comande[x.o.id]} />
              : <CardOrdine key={x.o.id} ordine={x.o} ora={ora} nuovo={nuovi.includes(x.o.id)} {...azioniDi(`ordine:${x.o.id}`)} leggi={() => leggi(x.o.id)} comande={comande[x.o.id]} />)}
          </section> })}
      </div>
    </section>
    <section aria-label="Tavoli" hidden={vista !== 'tavoli'} className="b-staff__vista">
      <VistaTavoli tavoli={tavoli} riepiloghi={riepiloghi} ordini={ordini} azioniDi={azioniDi} />
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
