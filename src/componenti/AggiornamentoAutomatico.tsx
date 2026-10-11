'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { prossimoStatoConnessione, verificaConnessione, type StatoConnessione } from '@/domain/connessione'
export function AggiornamentoAutomatico({ ogniSecondi,ultimoAggiornamento }: { ogniSecondi: number; ultimoAggiornamento?: string }) {
  const router = useRouter()
  const [stato,setStato] = useState<StatoConnessione>({ offline: false,ultimoAggiornamento: ultimoAggiornamento ?? null })
  const ultimo = useRef(ultimoAggiornamento)
  useEffect(() => { ultimo.current = ultimoAggiornamento },[ultimoAggiornamento])
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    let richiesta: AbortController | undefined
    let occupato = false, attivo = true
    const ferma = () => { if (timer) clearInterval(timer); timer = undefined }
    const errore = () => setStato(s => prossimoStatoConnessione(s,false,null))
    const aggiorna = async () => {
      if (occupato || document.visibilityState !== 'visible') return
      if (!navigator.onLine) { errore(); return }
      occupato = true; richiesta = new AbortController()
      const ok = await verificaConnessione(fetch,richiesta.signal)
      occupato = false
      if (!attivo || document.visibilityState !== 'visible') return
      setStato(s => prossimoStatoConnessione(s,ok,ultimo.current ?? null))
      if (ok) router.refresh()
    }
    const avvia = () => {
      ferma()
      if (!navigator.onLine) errore()
      if (document.visibilityState === 'visible') timer = setInterval(() => { void aggiorna() },ogniSecondi * 1000)
    }
    const riprendi = () => { avvia(); if (document.visibilityState !== 'visible') richiesta?.abort(); else void aggiorna() }
    avvia()
    document.addEventListener('visibilitychange',riprendi)
    window.addEventListener('online',riprendi)
    window.addEventListener('offline',errore)
    return () => { attivo = false; ferma(); richiesta?.abort(); document.removeEventListener('visibilitychange',riprendi); window.removeEventListener('online',riprendi); window.removeEventListener('offline',errore) }
  },[ogniSecondi,router])
  const data = ultimoAggiornamento ?? stato.ultimoAggiornamento
  return stato.offline ? <p role="status" className="tavolo-connessione">Connessione assente: i dati potrebbero non essere aggiornati<br />{data ? `Ultimo aggiornamento riuscito alle ${new Date(data).toLocaleTimeString('it-IT',{ timeZone: 'Europe/Rome' })}` : 'Nessun aggiornamento riuscito in questa pagina.'}</p> : null
}
