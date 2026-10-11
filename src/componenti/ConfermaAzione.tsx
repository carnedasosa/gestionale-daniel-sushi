'use client'
import { useState } from 'react'
import { Pannello } from './Pannello'

export function ConfermaAzione({ children, domanda, inCorso, conferma }: { children: React.ReactNode; domanda: string; inCorso: boolean; conferma: () => void }) {
  const [aperto, setAperto] = useState(false)
  return <>
    <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => setAperto(true)}>{children}</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Conferma operazione">
      <p>{domanda}</p>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => { setAperto(false); conferma() }}>Conferma</button>
    </Pannello>
  </>
}
