'use client'
import Link from 'next/link'
import { useContext, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro } from '@/domain/soldi'
import { LIMITE_SESSIONE } from '@/domain/limiti-tentativi'
import { arriviCucina, leggiStatoArrivi, segnaLetto, type StatoArrivi } from '@/domain/arrivi-cucina'
import type { OrdineClient, RiepilogoTavolo } from '@/tavoli/ordini-repo'
import type { TavoloConSessione, ContoRecente } from '@/tavoli/repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { SuonoTurno } from './InizioTurno'
import { ChiudiTavolo } from './ChiudiTavolo'
import { CardOrdineCasa, PannelloOrdiniOnline, type OrdiniOnline } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { colonnaCucina } from '@/domain/stati-casa'
import { apriTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, type EsitoStaff } from './azioni'

type Esegui = (azione: () => Promise<EsitoStaff>) => void
export type TavoloStaff = Omit<TavoloConSessione,'sessione'> & { sessione: (Omit<NonNullable<TavoloConSessione['sessione']>,'apertaIl'> & { apertaIl: string }) | null }
export function CardOrdine({ ordine: o,ora,nuovo,inCorso,leggi,esegui }: { ordine: OrdineClient; ora: string; nuovo: boolean; inCorso: boolean; leggi: () => void; esegui: Esegui }) {
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(o.creatoIl).getTime()) / 60000))
  return <article className={`ds-card staff-ordine${nuovo ? ' staff-ordine--nuovo' : ''}`} onPointerDown={leggi}>
    <h3 className="heading-sm">{o.tavoloNome} · n. {o.numero}</h3><p>{minuti} min · {formatEuro(o.totaleCent)} {nuovo && <span className="ds-badge ds-badge--new">Nuovo ordine</span>}</p>
    {o.tavoloChiuso && <p className="staff-nota">Tavolo chiuso</p>}
    <DettaglioRighe righe={o.righe} area="staff" azioneRiga={r => <ConfermaAzione inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => esegui(() => annullaRigaStaff(r.id))}>Annulla<span className="visually-hidden"> {r.nome}</span></ConfermaAzione>} />
    <div className="staff-azioni"><button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => { leggi(); esegui(() => avanzaOrdine(o.id)) }}>{o.stato === 'inviato' ? 'In preparazione' : 'Servito'}</button>
      <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}?`} conferma={() => esegui(() => annullaOrdineStaff(o.id))}>Annulla ordine</ConfermaAzione>
      {nuovo && <button type="button" className="ds-btn ds-btn--secondary" onClick={leggi}>Segna come letto</button>}
    </div>
  </article>
}
export interface DatiStaff { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; contiRecenti: (Omit<ContoRecente,'chiusaIl'> & { chiusaIl: string })[]; casa: OrdineCasaClient[]; ordiniOnline: OrdiniOnline }
const CHIAVE_ARRIVI = 'ds_arrivi_cucina'
function arriviSalvati(): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(CHIAVE_ARRIVI)) } catch { return null }
}
function salvaArrivi(stato: StatoArrivi) {
  try { sessionStorage.setItem(CHIAVE_ARRIVI,JSON.stringify(stato)) } catch { /* Senza storage la memoria resta solo in questa pagina. */ }
}
export function SchermoStaff({ dati,ora }: { dati: DatiStaff | null; ora: string }) {
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
  if (!mostrati || !ordini) return <p role="status">Caricamento dello schermo…</p>
  const { tavoli,riepiloghi,contiRecenti,casa,ordiniOnline } = mostrati
  // Tavoli e casa nella stessa cucina: la casa per orario della fascia, i tavoli per arrivo.
  const cucina = [...ordini.map(o => ({ casa: false as const,o,quando: o.creatoIl })),...casa.filter(o => colonnaCucina(o.stato)).map(o => ({ casa: true as const,o,quando: o.fascia }))]
    .sort((a,b) => a.quando.localeCompare(b.quando))
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
    <PannelloOrdiniOnline stato={ordiniOnline} inCorso={inCorso} esegui={esegui} />
    <section><h2 className="heading">Da accettare</h2>{!inAttesa && <p>Nessun ordine da accettare.</p>}
      <div className="staff-tavoli">{casa.filter(o => o.stato === 'in_attesa').map(o => <CardOrdineCasa key={o.id} ordine={o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare />)}</div></section>
    <section><h2 className="heading">Cucina</h2><div className="staff-colonne staff-colonne--tre">{(['da_preparare','in_preparazione','pronti'] as const).map(colonna => { const qui = cucina.filter(x => colonnaCucina(x.o.stato) === colonna)
      return <section key={colonna}>
        <h3 className="heading-sm">{{ da_preparare: 'Da preparare',in_preparazione: 'In preparazione',pronti: 'Pronti e in consegna' }[colonna]}</h3>
        {!qui.length && <p>Nessun ordine.</p>}
        {qui.map(x => x.casa ? <CardOrdineCasa key={x.o.id} ordine={x.o} ora={ora} inCorso={inCorso} esegui={esegui} daAccettare={false} />
          : <CardOrdine key={x.o.id} ordine={x.o} ora={ora} nuovo={nuovi.includes(x.o.id)} inCorso={inCorso} leggi={() => leggi(x.o.id)} esegui={esegui} />)}
      </section> })}</div></section>
    <section><h2 className="heading">Tavoli</h2>{!tavoli.length && <p>Nessun tavolo configurato. Chiedi all’admin di aggiungerli.</p>}<div className="staff-tavoli">{tavoli.filter(t => t.attivo || t.sessione).map(t => {
      const s = t.sessione, r = riepiloghi.find(r => r.sessioneId === s?.id)
      return <article className="ds-card staff-tavolo" key={t.id}><h3 className="heading-sm">{t.nome}</h3>{s ? <>
        <p className="display staff-codice" aria-label={`Codice ${s.codice}`}>{s.codice}</p><p>Aperto alle {new Date(s.apertaIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</p>
        {s.tentativi > 0 && <div className="staff-azioni"><p>{s.tentativi} tentativi sbagliati{s.tentativi >= LIMITE_SESSIONE && ': nessun nuovo telefono può entrare finché non sblocchi'}</p><button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => sbloccaTavolo(s.id))}>Sblocca</button></div>}
        <p>{r?.numeroOrdini ?? 0} ordini · {formatEuro(r?.totaleCent ?? 0)}</p><div className="staff-azioni"><Link className="ds-btn ds-btn--secondary" href={`/staff/conto/${s.id}`}>Conto</Link>
          <ChiudiTavolo sessioneId={s.id} /></div>
      </> : <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => apriTavolo(t.id))}>Apri tavolo</button>}</article>
    })}</div></section>
    <section><h2 className="heading">Conti recenti</h2>{!contiRecenti.length && <p>Nessun tavolo chiuso nelle ultime 6 ore.</p>}<ul className="staff-conti-recenti">{contiRecenti.map(c => <li key={c.id}><Link className="ds-link" href={`/staff/conto/${c.id}`}>{c.tavoloNome} · chiuso alle {new Date(c.chiusaIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</Link></li>)}</ul></section>
  </>
}
