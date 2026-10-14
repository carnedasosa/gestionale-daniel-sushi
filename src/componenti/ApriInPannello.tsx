'use client'
import { useState } from 'react'
import { Pannello } from './Pannello'
/** Un bottone che apre un pannello con dentro un modulo (i figli arrivano già pronti dal server). */
export function ApriInPannello({ etichetta,titolo,classe = 'b-btn b-btn--secondario',children }: { etichetta: React.ReactNode; titolo: string; classe?: string; children: React.ReactNode }) {
  const [aperto,setAperto] = useState(false)
  return <>
    <button type="button" className={classe} onClick={() => setAperto(true)}>{etichetta}</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo={titolo}>{children}</Pannello>
  </>
}
