'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pannello } from '@/componenti/Pannello'
import { MAX_PERSONE } from '@/domain/divisione-conto'
import { stampaPreconto } from './azioni-stampa'

const ora = (iso: string) => new Date(iso).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })
/** «Pre-conto»: esce alla stampante della cassa, con la quota a testa se si sceglie per quante persone dividere. */
export function Preconto({ sessioneId,coperti,stampatoIl,ordiniDopo }: { sessioneId: string; coperti: number | null; stampatoIl: string | null; ordiniDopo: number }) {
  const [aperto,setAperto] = useState(false)
  const [dividi,setDividi] = useState(false)
  const [persone,setPersone] = useState(Math.max(2,coperti ?? 2))
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const router = useRouter()
  const stampa = () => startTransition(async () => {
    setErrore(null)
    try { const e = await stampaPreconto(sessioneId,dividi ? persone : null); if (e.ok) setAperto(false); else setErrore(e.errore ?? 'Pre-conto non stampato, riprova.'); router.refresh() }
    catch { setErrore('Pre-conto non stampato, riprova.') }
  })
  return <div className="b-preconto">
    <button type="button" className="b-btn b-btn--secondario" onClick={() => { setErrore(null); setAperto(true) }}>Pre-conto</button>
    {stampatoIl && <p className="b-secondario b-piccolo">Pre-conto stampato alle <span className="b-num">{ora(stampatoIl)}</span></p>}
    {stampatoIl && ordiniDopo > 0 && <p role="status" className="b-avviso b-avviso--accettare">{ordiniDopo === 1 ? 'Dopo il pre-conto è arrivato 1 ordine' : `Dopo il pre-conto sono arrivati ${ordiniDopo} ordini`}: ristampalo prima di incassare.</p>}
    {errore && !aperto && <p role="alert" className="b-errore">{errore}</p>}
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Pre-conto">
      <div className="b-incasso__pannello">
        <p className="b-secondario">Esce alla stampante della cassa. Non è uno scontrino.</p>
        <label className="b-scelta"><input type="checkbox" checked={dividi} onChange={e => setDividi(e.target.checked)} />Scrivi la quota a testa</label>
        {dividi && <div className="b-incasso__riga"><span>Persone</span>
          <div className="b-quantita b-quantita--chiara" role="group" aria-label="Persone">
            <button type="button" className="b-quantita__btn" aria-label="Persone: meno" disabled={persone <= 2} onClick={() => setPersone(persone - 1)}>−</button>
            <span className="b-num" aria-live="polite">{persone}</span>
            <button type="button" className="b-quantita__btn" aria-label="Persone: più" disabled={persone >= MAX_PERSONE} onClick={() => setPersone(persone + 1)}>+</button>
          </div></div>}
        {errore && <p role="alert" className="b-errore">{errore}</p>}
        <div className="b-azioni b-azioni--fine"><button type="button" className="b-btn b-btn--principale" disabled={inCorso} aria-busy={inCorso} onClick={stampa}>{inCorso ? 'Invio alla stampante…' : 'Stampa il pre-conto'}</button></div>
      </div>
    </Pannello>
  </div>
}
