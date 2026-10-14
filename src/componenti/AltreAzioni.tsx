'use client'
import { useState } from 'react'
import { Pannello } from './Pannello'
/** Azioni rare o pericolose di una card, fuori dalla vista finché non servono. `children` riceve `chiudi`. */
export function AltreAzioni({ titolo,children }: { titolo: string; children: (chiudi: () => void) => React.ReactNode }) {
  const [aperto,setAperto] = useState(false)
  const chiudi = () => setAperto(false)
  return <>
    <button type="button" className="b-btn b-btn--discreto" onClick={() => setAperto(true)}>Altre azioni</button>
    <Pannello aperto={aperto} chiudi={chiudi} titolo={titolo}><div className="b-altre">{children(chiudi)}</div></Pannello>
  </>
}
