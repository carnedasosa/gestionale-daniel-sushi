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
  return <div>
    {primaria ? <button type="button" className="ds-btn ds-btn--primary" disabled={inCorso} onClick={() => esegui()}>Chiudi tavolo</button>
      : <ConfermaAzione inCorso={inCorso} domanda="Chiudere il tavolo? I clienti non potranno più ordinare." conferma={() => esegui()}>Chiudi tavolo</ConfermaAzione>}
    {errore && <p role="alert">{errore}</p>}
    <Pannello aperto={!!avviso} chiudi={() => setAvviso(undefined)} titolo="Conferma chiusura">
      <p>{domanda}</p><button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(true)}>Chiudi comunque</button>
    </Pannello>
  </div>
}
