'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { Pannello } from '@/componenti/Pannello'
import { chiudiTavolo, type EsitoStaff } from './azioni'

export function ChiudiTavolo({ sessioneId,contoVistoAlle = null,primaria = false }: { sessioneId: string; contoVistoAlle?: string | null; primaria?: boolean }) {
  const [inCorso,startTransition] = useTransition()
  const occupato = useRef(false)
  const [errore,setErrore] = useState<string | null>(null)
  const [avviso,setAvviso] = useState<EsitoStaff['avviso']>(undefined)
  const router = useRouter()
  const esegui = (forza = false) => {
    if (occupato.current) return
    occupato.current = true; setErrore(null)
    startTransition(async () => {
      try {
        const e = await chiudiTavolo(sessioneId,contoVistoAlle,forza)
        if (e.ok) { setAvviso(undefined); router.push(`/staff/conto/${sessioneId}`); router.refresh() }
        else if (e.avviso) setAvviso(e.avviso)
        else setErrore(e.errore ?? 'Chiusura non riuscita, riprova.')
      } catch { setErrore('Chiusura non riuscita, riprova.') }
      finally { occupato.current = false }
    })
  }
  const domanda = avviso ? avviso.motivo==='ordini_in_cucina'
    ? `${avviso.n===1 ? 'C’è 1 ordine ancora' : `Ci sono ${avviso.n} ordini ancora`} in cucina: chiudere comunque?`
    : `${avviso.n===1 ? 'C’è 1 ordine arrivato' : `Ci sono ${avviso.n} ordini arrivati`} dopo il conto: chiudere comunque?` : ''
  return <div className="b-chiudi-tavolo">
    {primaria ? <button type="button" className="b-btn b-btn--pieno-pericolo b-btn--staff" disabled={inCorso} aria-busy={inCorso} onClick={() => esegui()}>{inCorso ? 'Chiusura in corso…' : 'Chiudi tavolo'}</button>
      : <ConfermaAzione inCorso={inCorso} domanda="Chiudere il tavolo? I clienti non potranno più ordinare." conferma={() => esegui()}>Chiudi tavolo</ConfermaAzione>}
    {errore && <p role="alert" className="b-errore">{errore}</p>}
    <Pannello aperto={!!avviso} chiudi={() => setAvviso(undefined)} titolo="Chiudi tavolo">
      <p>{domanda}</p><div className="b-azioni b-azioni--fine"><button type="button" className="b-btn b-btn--secondario" onClick={() => setAvviso(undefined)}>Annulla</button><button type="button" className="b-btn b-btn--pieno-pericolo" disabled={inCorso} aria-busy={inCorso} onClick={() => esegui(true)}>{inCorso ? 'Chiusura in corso…' : 'Chiudi comunque'}</button></div>
    </Pannello>
  </div>
}
