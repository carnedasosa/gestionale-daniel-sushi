'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_COPERTI } from '@/domain/coperti'
import { cambiaCoperti } from './azioni'

/** Coperti del tavolo con − e +: si segnano quando la sala lo sa (anche dopo l'apertura). Il − dall'1 li toglie. */
export function Coperti({ sessioneId,coperti }: { sessioneId: string; coperti: number | null }) {
  const [inCorso,startTransition] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  const cambia = (n: number | null) => startTransition(async () => {
    setErrore(null)
    try { const e = await cambiaCoperti(sessioneId,n); if (!e.ok) setErrore(e.errore ?? 'Coperti non salvati, riprova.'); router.refresh() }
    catch { setErrore('Coperti non salvati, riprova.') }
  })
  return <div className="b-coperti">
    <span>Coperti</span>
    <div className="b-quantita b-quantita--chiara" role="group" aria-label="Coperti del tavolo" aria-busy={inCorso}>
      <button type="button" className="b-quantita__btn" aria-label="Un coperto in meno" disabled={inCorso || coperti === null} onClick={() => cambia(coperti && coperti > 1 ? coperti - 1 : null)}>−</button>
      <span className="b-num" aria-live="polite">{coperti ?? '–'}</span>
      <button type="button" className="b-quantita__btn" aria-label="Un coperto in più" disabled={inCorso || coperti === MAX_COPERTI} onClick={() => cambia((coperti ?? 0) + 1)}>+</button>
    </div>
    {errore && <p role="alert" className="b-errore">{errore}</p>}
  </div>
}
