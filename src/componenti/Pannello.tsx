'use client'
import { useEffect, useId, useRef } from 'react'
export function Pannello({ aperto,chiudi,titolo,children }: { aperto: boolean; chiudi: () => void; titolo: string; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const elemento = dialog.current!
    if (aperto && !elemento.open) elemento.showModal()
    if (!aperto && elemento.open) elemento.close()
  },[aperto])
  return <dialog ref={dialog} className="tavolo-pannello" aria-labelledby={id} onCancel={chiudi} onClose={chiudi}>
    <div className="tavolo-pannello-testa"><h2 id={id} className="heading-sm">{titolo}</h2><button className="ds-btn ds-btn--secondary" type="button" onClick={chiudi}>Chiudi</button></div>
    {children}
  </dialog>
}
