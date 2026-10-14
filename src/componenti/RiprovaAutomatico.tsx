'use client'
import { useCallback, useEffect, useState } from 'react'
import { verificaConnessione } from '@/domain/connessione'
export function RiprovaAutomatico({ retry }: { retry: () => void }) {
  const [secondi,setSecondi] = useState(10)
  const [offline,setOffline] = useState(false)
  const riprova = useCallback(async () => {
    const ok = await verificaConnessione()
    setOffline(!ok)
    if (ok) retry()
  },[retry])
  useEffect(() => {
    let restanti = 10, attivo = true
    const timer = setInterval(() => {
      restanti--
      if (restanti===0) { restanti=10; if (attivo && document.visibilityState==='visible') void riprova() }
      setSecondi(restanti)
    },1000)
    return () => { attivo = false; clearInterval(timer) }
  },[riprova])
  return <><button type="button" className="b-btn b-btn--principale" onClick={() => { void riprova() }}>Riprova</button><p role="status">Nuovo tentativo tra {secondi} s</p>{offline && <p className="b-avviso b-avviso--accettare">Connessione assente: riproverò da solo.</p>}</>
}
