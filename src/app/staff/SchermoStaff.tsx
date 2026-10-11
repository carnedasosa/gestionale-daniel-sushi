'use client'
import Link from 'next/link'
import { useContext, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro } from '@/domain/soldi'
import type { OrdineClient, RiepilogoTavolo } from '@/tavoli/ordini-repo'
import type { TavoloConSessione } from '@/tavoli/repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { SuonoTurno } from './InizioTurno'
import { apriTavolo, chiudiTavolo, sbloccaTavolo, avanzaOrdine, annullaOrdineStaff, annullaRigaStaff, type EsitoStaff } from './azioni'

type Esegui = (azione: () => Promise<EsitoStaff>) => void
export type TavoloStaff = Omit<TavoloConSessione,'sessione'> & { sessione: (Omit<NonNullable<TavoloConSessione['sessione']>,'apertaIl'> & { apertaIl: string }) | null }
export function CardOrdine({ ordine: o,ora,nuovo,inCorso,leggi,esegui }: { ordine: OrdineClient; ora: string; nuovo: boolean; inCorso: boolean; leggi: () => void; esegui: Esegui }) {
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(o.creatoIl).getTime()) / 60000))
  return <article className={`ds-card staff-ordine${nuovo ? ' staff-ordine--nuovo' : ''}`} onPointerDown={leggi}>
    <h3 className="heading-sm">{o.tavoloNome} · n. {o.numero}</h3><p>{minuti} min · {formatEuro(o.totaleCent)} {nuovo && <span className="ds-badge ds-badge--new">Nuovo ordine</span>}</p>
    <DettaglioRighe righe={o.righe} area="staff" azioneRiga={r => <ConfermaAzione inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => esegui(() => annullaRigaStaff(r.id))}>Annulla<span className="visually-hidden"> {r.nome}</span></ConfermaAzione>} />
    <div className="staff-azioni"><button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => { leggi(); esegui(() => avanzaOrdine(o.id)) }}>{o.stato === 'inviato' ? 'In preparazione' : 'Servito'}</button>
      <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}?`} conferma={() => esegui(() => annullaOrdineStaff(o.id))}>Annulla ordine</ConfermaAzione>
      {nuovo && <button type="button" className="ds-btn ds-btn--secondary" onClick={leggi}>Segna come letto</button>}
    </div>
  </article>
}
export function SchermoStaff({ tavoli,ordini,riepiloghi,ora }: { tavoli: TavoloStaff[]; ordini: OrdineClient[]; riepiloghi: RiepilogoTavolo[]; ora: string }) {
  const [errore,setErrore] = useState<string | null>(null)
  const [nuovi,setNuovi] = useState<Set<string>>(new Set())
  const visti = useRef(new Set<string>())
  const [inCorso,startTransition] = useTransition()
  const bloccato = useRef(false)
  const router = useRouter(), suona = useContext(SuonoTurno)
  useEffect(() => {
    const nuoviIds = ordini.filter(o => !visti.current.has(o.id)).map(o => o.id)
    for (const o of ordini) visti.current.add(o.id)
    if (nuoviIds.length) {
      setNuovi(s => new Set([...s,...nuoviIds])); suona(3)
    }
  },[ordini,suona])
  const leggi = (id: string) => setNuovi(s => { const prossimi = new Set(s); prossimi.delete(id); return prossimi })
  const esegui: Esegui = azione => {
    if (bloccato.current) return
    bloccato.current = true; setErrore(null)
    startTransition(async () => {
      try { const esito = await azione(); if (!esito.ok) setErrore(esito.errore ?? 'Operazione non riuscita, riprova.'); router.refresh() }
      catch { setErrore('Operazione non riuscita, riprova.') }
      finally { bloccato.current = false }
    })
  }
  return <>
    {errore && <p role="alert" className="staff-nota">{errore}</p>}
    <section><h2 className="heading">Cucina</h2><div className="staff-colonne">{(['inviato','in_preparazione'] as const).map(stato => <section key={stato}>
      <h3 className="heading-sm">{stato === 'inviato' ? 'Inviati' : 'In preparazione'}</h3>
      {!ordini.some(o => o.stato === stato) && <p>Nessun ordine.</p>}
      {ordini.filter(o => o.stato === stato).map(o => <CardOrdine key={o.id} ordine={o} ora={ora} nuovo={nuovi.has(o.id)} inCorso={inCorso} leggi={() => leggi(o.id)} esegui={esegui} />)}
    </section>)}</div></section>
    <section><h2 className="heading">Tavoli</h2>{!tavoli.length && <p>Nessun tavolo configurato. Chiedi all’admin di aggiungerli.</p>}<div className="staff-tavoli">{tavoli.filter(t => t.attivo || t.sessione).map(t => {
      const s = t.sessione, r = riepiloghi.find(r => r.sessioneId === s?.id)
      return <article className="ds-card staff-tavolo" key={t.id}><h3 className="heading-sm">{t.nome}</h3>{s ? <>
        <p className="display staff-codice" aria-label={`Codice ${s.codice}`}>{s.codice}</p><p>Aperto alle {new Date(s.apertaIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</p>
        {s.tentativi > 0 && <div className="staff-azioni"><p>{s.tentativi} tentativi sbagliati</p><button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => sbloccaTavolo(s.id))}>Sblocca</button></div>}
        <p>{r?.numeroOrdini ?? 0} ordini · {formatEuro(r?.totaleCent ?? 0)}</p><div className="staff-azioni"><Link className="ds-btn ds-btn--secondary" href={`/staff/conto/${s.id}`}>Conto</Link>
          <ConfermaAzione inCorso={inCorso} domanda={`Chiudere il tavolo ${t.nome}? I clienti non potranno più ordinare.`} conferma={() => esegui(() => chiudiTavolo(s.id))}>Chiudi tavolo</ConfermaAzione></div>
      </> : <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => apriTavolo(t.id))}>Apri tavolo</button>}</article>
    })}</div></section>
  </>
}
