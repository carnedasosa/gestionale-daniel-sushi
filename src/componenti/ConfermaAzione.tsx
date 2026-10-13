'use client'
import { useState } from 'react'
import { Pannello } from './Pannello'

// `stile`: aspetto del bottone che apre la conferma; quello che conferma è sempre pieno e rosso.
export function ConfermaAzione({ children, domanda, inCorso, conferma, stile = 'pericolo' }: { children: React.ReactNode; domanda: string; inCorso: boolean; conferma: () => void; stile?: 'secondario' | 'pericolo' | 'discreto' }) {
  const [aperto, setAperto] = useState(false)
  const classe = { secondario: 'b-btn b-btn--secondario',pericolo: 'b-btn b-btn--pericolo',discreto: 'b-btn b-btn--discreto b-btn--pericolo' }[stile]
  return <>
    <button type="button" className={classe} disabled={inCorso} onClick={() => setAperto(true)}>{children}</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Conferma">
      <p>{domanda}</p>
      <div className="b-azioni b-azioni--fine">
        <button type="button" className="b-btn b-btn--secondario" onClick={() => setAperto(false)}>Annulla</button>
        <button type="button" className="b-btn b-btn--pieno-pericolo" disabled={inCorso} onClick={() => { setAperto(false); conferma() }}>{children}</button>
      </div>
    </Pannello>
  </>
}
