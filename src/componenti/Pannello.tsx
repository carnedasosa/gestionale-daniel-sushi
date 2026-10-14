'use client'
import { useEffect, useId, useRef } from 'react'
/** Finestra modale (<dialog>): sale dal basso sul telefono, centrata sugli schermi larghi. */
export function Pannello({ aperto,chiudi,titolo,children }: { aperto: boolean; chiudi: () => void; titolo: string; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const elemento = dialog.current!
    if (aperto && !elemento.open) elemento.showModal()
    if (!aperto && elemento.open) elemento.close()
  },[aperto])
  return <dialog ref={dialog} className="b-pannello" aria-labelledby={id} onCancel={chiudi} onClose={chiudi}>
    <div className="b-pannello__testa"><h2 id={id}>{titolo}</h2><button className="b-btn b-btn--secondario b-btn--tondo" type="button" onClick={chiudi} aria-label="Chiudi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
    <div className="b-pannello__corpo">{children}</div>
  </dialog>
}
