'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
export function AggiornamentoAutomatico({ ogniSecondi }: { ogniSecondi: number }) {
  const router = useRouter()
  const [offline,setOffline] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const ferma = () => { if (timer) clearInterval(timer); timer = undefined }
    const aggiorna = () => { if (navigator.onLine && document.visibilityState === 'visible') router.refresh() }
    const avvia = () => {
      ferma()
      setOffline(!navigator.onLine)
      if (document.visibilityState === 'visible' && navigator.onLine) timer = setInterval(aggiorna,ogniSecondi * 1000)
    }
    const riprendi = () => { avvia(); aggiorna() }
    avvia()
    document.addEventListener('visibilitychange',riprendi)
    window.addEventListener('online',riprendi)
    window.addEventListener('offline',avvia)
    return () => { ferma(); document.removeEventListener('visibilitychange',riprendi); window.removeEventListener('online',riprendi); window.removeEventListener('offline',avvia) }
  },[ogniSecondi,router])
  return offline ? <p role="status">Connessione assente: i dati potrebbero non essere aggiornati</p> : null
}
