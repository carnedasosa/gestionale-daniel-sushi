'use client'
import { createContext, useCallback, useEffect, useRef, useState } from 'react'
export const SuonoTurno = createContext<(ripetizioni?: number) => void>(() => {})
// Il contesto audio vive quanto la pagina del browser, non quanto il componente: se lo schermo
// viene rimontato (navigazione nell'area staff, errore temporaneo) il suono resta attivo.
let audioCondiviso: AudioContext | null = null
export function InizioTurno({ children,uscita }: { children: React.ReactNode; uscita?: React.ReactNode }) {
  const [iniziato,setIniziato] = useState(false)
  // Sul server e alla prima idratazione audioCondiviso è null: nessuna differenza tra HTML e client.
  const [audioAttivo,setAudioAttivo] = useState(() => audioCondiviso?.state === 'running')
  const [avviso,setAvviso] = useState<string | null>(null)
  const lock = useRef<WakeLockSentinel | null>(null)
  const suona = useCallback((ripetizioni = 1) => {
    const ctx = audioCondiviso
    if (!ctx || ctx.state !== 'running') return
    for (let i = 0; i < ripetizioni; i++) {
      const oscillatore = ctx.createOscillator(), volume = ctx.createGain()
      oscillatore.connect(volume); volume.connect(ctx.destination); oscillatore.frequency.value = 880
      const quando = ctx.currentTime + i * .4
      volume.gain.setValueAtTime(.08,quando); volume.gain.exponentialRampToValueAtTime(.001,quando + .18)
      oscillatore.start(quando); oscillatore.stop(quando + .2)
    }
  },[])
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Ripristino della preferenza da sessionStorage.
      if (sessionStorage.getItem('ds_turno') === 'iniziato') setIniziato(true)
    } catch { /* Si può iniziare il turno anche senza storage. */ }
    const ctx = audioCondiviso
    if (ctx) ctx.onstatechange = () => setAudioAttivo(ctx.state==='running')
    // Il contesto non si chiude allo smontaggio: lo riprende il prossimo montaggio.
    return () => { if (ctx) ctx.onstatechange = null }
  },[])
  useEffect(() => {
    let attivo = true
    const acquisisci = async () => {
      if (!iniziato || document.visibilityState !== 'visible' || !('wakeLock' in navigator) || (lock.current && !lock.current.released)) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (!attivo) { await sentinel.release(); return }
        lock.current = sentinel
        setAvviso(null)
      } catch { setAvviso('Schermo sempre acceso non disponibile: controlla le impostazioni del dispositivo.') }
    }
    const visibilita = () => { void acquisisci(); if (audioCondiviso?.state !== 'running') setAudioAttivo(false) }
    void acquisisci(); document.addEventListener('visibilitychange',visibilita)
    return () => { attivo = false; document.removeEventListener('visibilitychange',visibilita); void lock.current?.release().catch(() => {}); lock.current = null }
  },[iniziato])
  const inizia = async () => {
    setIniziato(true)
    try { sessionStorage.setItem('ds_turno','iniziato') } catch { /* Stato in memoria. */ }
    try {
      if (!audioCondiviso || audioCondiviso.state==='closed') audioCondiviso = new AudioContext()
      const ctx = audioCondiviso
      ctx.onstatechange = () => setAudioAttivo(ctx.state==='running')
      await ctx.resume(); setAudioAttivo(ctx.state==='running'); suona()
    }
    catch { setAvviso('Audio non disponibile: controlla lo schermo per i nuovi ordini.') }
  }
  if (!iniziato) return <div className="b-inizio"><div className="b-inizio__riquadro">
    <div className="b-inizio__testa"><span className="b-num b-secondario" suppressHydrationWarning>{new Date().toLocaleString('it-IT',{ weekday: 'long',day: 'numeric',month: 'long',hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</span>
      <h2 className="b-inizio__titolo">Buon turno</h2><p className="b-secondario">Prima di cominciare il tablet deve poter suonare e restare acceso.</p></div>
    <ul className="b-inizio__voci">
      <li><strong>Suono per i nuovi ordini</strong><span className="b-secondario">Tre bip a ogni ordine, e ogni 10 secondi finché c’è un ordine da casa da accettare</span></li>
      <li><strong>Schermo sempre acceso</strong><span className="b-secondario">Il tablet non va in standby durante il turno</span></li>
    </ul>
    <p className="b-nascosto">Attiva suono e schermo sempre acceso</p>
    <button type="button" className="b-btn b-btn--principale b-btn--grande" onClick={inizia}>Inizia turno</button>
    <p className="b-secondario b-piccolo b-inizio__nota">Gli ordini online di stasera si aprono dopo, dalla barra in alto.</p>
    {uscita}
  </div></div>
  return <SuonoTurno.Provider value={suona}>{!audioAttivo && <div className="b-avviso b-avviso--accettare b-staff__avviso"><p>Il suono è sospeso: senza, i nuovi ordini non suonano.</p><button type="button" className="b-btn b-btn--secondario" onClick={inizia}>Riattiva suono</button></div>}{avviso && <p role="status" className="b-avviso b-staff__avviso">{avviso}</p>}{children}</SuonoTurno.Provider>
}
