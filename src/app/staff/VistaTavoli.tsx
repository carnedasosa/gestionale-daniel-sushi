'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { LIMITE_SESSIONE } from '@/domain/limiti-tentativi'
import { riassuntoTavolo } from '@/domain/stati-tavolo'
import type { OrdineClient, RiepilogoTavolo } from '@/tavoli/ordini-repo'
import type { TavoloStaff } from './SchermoStaff'
import { ChiudiTavolo } from './ChiudiTavolo'
import { Coperti } from './Coperti'
import { apriTavolo, sbloccaTavolo } from './azioni'
import type { AzioniDi } from './useEsegui'
const ora = (iso: string) => new Date(iso).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })

/** Tavolo del dettaglio: quello scelto finché è aperto (poi nessuno, mai un altro da solo); senza scelta il primo aperto. */
export function tavoloDelDettaglio(visibili: TavoloStaff[], scelto: string | null): TavoloStaff | null {
  if (scelto) return visibili.find(t => t.id === scelto && t.sessione) ?? null
  return visibili.find(t => t.sessione) ?? null
}
/** Piantina dei tavoli: aperti con codice e riassunto, liberi da aprire; il tocco su un aperto mostra il dettaglio. */
// `azioniDi`: lo stato «in corso» vale per il singolo tavolo (chiave `tavolo:<id>`), non per tutta la piantina.
export function VistaTavoli({ tavoli,riepiloghi,ordini,azioniDi }: { tavoli: TavoloStaff[]; riepiloghi: RiepilogoTavolo[]; ordini: OrdineClient[]; azioniDi: AzioniDi }) {
  const visibili = tavoli.filter(t => t.attivo || t.sessione)
  const [scelto,setScelto] = useState<string | null>(null)
  const selezionato = tavoloDelDettaglio(visibili,scelto)
  const titolo = useRef<HTMLHeadingElement>(null)
  // Su un tablet verticale il dettaglio sta sotto la piantina: dopo il tocco lo si porta in vista e gli si dà il fuoco.
  const mostra = (id: string) => { setScelto(id); requestAnimationFrame(() => { titolo.current?.scrollIntoView({ block: 'nearest' }); titolo.current?.focus({ preventScroll: true }) }) }
  if (!tavoli.length) return <p className="b-avviso">Nessun tavolo configurato. Chiedi all’admin di aggiungerli.</p>
  const dati = (t: TavoloStaff) => {
    const r = riepiloghi.find(x => x.sessioneId === t.sessione?.id)
    return { ordini: r?.numeroOrdini ?? 0,totale: r?.totaleCent ?? 0,inCucina: t.sessione ? riassuntoTavolo(ordini,t.sessione.id).inCucina : 0 }
  }
  const s = selezionato?.sessione, d = selezionato && dati(selezionato)
  const delTavolo = (id: string) => azioniDi(`tavolo:${id}`)
  return <div className="b-vista-tavoli">
    <div className="b-vista-tavoli__mappa">
      <ul className="b-legenda" aria-label="Legenda"><li><span className="b-legenda__segno b-legenda__segno--aperto" />Aperto</li><li><span className="b-legenda__segno b-legenda__segno--libero" />Libero</li><li><span className="b-legenda__segno b-legenda__segno--blocco" />Da sbloccare</li></ul>
      <div className="b-tavoli-griglia">{visibili.map(t => {
        const sess = t.sessione
        if (!sess) { const { inCorso,esegui } = delTavolo(t.id)
          return <article key={t.id} className="b-tavolo-tile b-tavolo-tile--libero">
          <h3 className="b-tavolo-tile__nome">{t.nome}</h3><p className="b-secondario">Libero</p>
          <button type="button" className="b-btn b-btn--secondario b-btn--staff b-btn--largo" disabled={inCorso} onClick={() => esegui(() => apriTavolo(t.id))}>Apri tavolo</button>
        </article> }
        const x = dati(t), bloccato = sess.tentativi >= LIMITE_SESSIONE
        return <article key={t.id} className={`b-tavolo-tile${bloccato ? ' b-tavolo-tile--blocco' : ''}${selezionato?.id === t.id ? ' b-tavolo-tile--scelto' : ''}`}>
          <h3 className="b-tavolo-tile__nome">{t.nome}</h3>
          <p className="b-num b-tavolo-tile__codice" aria-label={`Codice ${sess.codice}`}>{sess.codice}</p>
          <p className="b-secondario b-piccolo">dalle <span className="b-num">{ora(sess.apertaIl)}</span> · {x.ordini} ordini · <span className="b-num">{formatEuro(x.totale)}</span></p>
          {sess.tentativi > 0 ? <span className="b-etichetta b-etichetta--ritardo">{sess.tentativi} codici sbagliati</span>
            : x.inCucina > 0 ? <span className="b-etichetta b-etichetta--preparazione">{x.inCucina} in cucina</span>
            : x.ordini > 0 ? <span className="b-etichetta b-etichetta--pronto">Tutto servito</span> : null}
          <button type="button" className="b-tavolo-tile__apri" aria-pressed={selezionato?.id === t.id} aria-controls="dettaglio-tavolo" onClick={() => mostra(t.id)}><span className="b-nascosto">Dettaglio di {t.nome}</span></button>
        </article>
      })}</div>
    </div>
    {selezionato && s && d && <aside id="dettaglio-tavolo" className="b-dettaglio-tavolo" aria-label={`Dettaglio di ${selezionato.nome}`}>
      <div className="b-dettaglio-tavolo__testa"><h2 ref={titolo} tabIndex={-1} className="b-titolo-2">{selezionato.nome}</h2><span className="b-num b-secondario">dalle {ora(s.apertaIl)}</span></div>
      <div className="b-dettaglio-tavolo__codice"><span className="b-piccolo">Codice da dare ai clienti</span><span className="b-num">{s.codice}</span></div>
      <Coperti key={s.id} sessioneId={s.id} coperti={s.coperti} />
      <div className="b-scontrino">
        <div className="b-scontrino__riga"><span>Ordini mandati</span><span className="b-num">{d.ordini}</span></div>
        <div className="b-scontrino__riga"><span>In cucina adesso</span><span className="b-num">{d.inCucina}</span></div>
        <div className="b-scontrino__totale"><span>Totale finora</span><span className="b-num">{formatEuro(d.totale)}</span></div>
      </div>
      {s.tentativi > 0 && <div className="b-avviso b-avviso--ritardo"><p>{s.tentativi} tentativi sbagliati{s.tentativi >= LIMITE_SESSIONE && ': nessun nuovo telefono può entrare finché non sblocchi'}</p><button type="button" className="b-btn b-btn--secondario" disabled={delTavolo(selezionato.id).inCorso} onClick={() => delTavolo(selezionato.id).esegui(() => sbloccaTavolo(s.id))}>Sblocca</button></div>}
      <div className="b-dettaglio-tavolo__azioni">
        <Link className="b-btn b-btn--principale b-btn--staff b-btn--largo" href={`/staff/tavolo/${s.id}/ordina`}>Ordina per il tavolo</Link>
        <Link className="b-btn b-btn--secondario b-btn--staff b-btn--largo" href={`/staff/conto/${s.id}`}>Apri il conto</Link>
        <ChiudiTavolo key={s.id} sessioneId={s.id} nome={selezionato.nome} />
      </div>
    </aside>}
  </div>
}
