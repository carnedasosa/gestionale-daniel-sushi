'use client'
import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ETICHETTA_POSTAZIONE, POSTAZIONI, type Postazione } from '@/domain/postazioni'
import { impostaPostazione } from './azioni-postazione'
export const SuonoTurno = createContext<(ripetizioni?: number) => void>(() => {})
// Il contesto audio vive quanto la pagina del browser, non quanto il componente: se lo schermo
// viene rimontato (navigazione nell'area staff, errore temporaneo) il suono resta attivo.
let audioCondiviso: AudioContext | null = null
const SUONI: Record<Postazione,string> = {
  cassa: 'Tre bip per bevande e piatti da portare al tavolo, e ogni 10 secondi finché c’è un ordine da casa da accettare',
  banco: 'Tre bip a ogni comanda nuova del banco sushi',
  cucina: 'Tre bip a ogni comanda nuova della cucina',
  sala: 'Tre bip per bevande e piatti da portare al tavolo',
}
/** `postazione`: quella con cui è stata disegnata la pagina; all'avvio del turno la scelta resta salvata sul dispositivo. */
export function InizioTurno({ children,uscita,postazione = 'cassa' }: { children: React.ReactNode; uscita?: React.ReactNode; postazione?: Postazione }) {
  const [iniziato,setIniziato] = useState(false)
  const [scelta,setScelta] = useState(postazione)
  const router = useRouter()
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
  // Il cookie si scrive anche se la postazione è quella mostrata (es. arrivata da `?postazione=`): le schede successive la ritrovano.
  const salvaPostazione = async () => {
    try {
      const esito = await impostaPostazione(scelta)
      if (esito.ok && scelta !== postazione) router.replace('/staff')
    } catch { /* Il turno parte comunque con la postazione mostrata. */ }
  }
  const attivaAudio = async () => {
    try {
      if (!audioCondiviso || audioCondiviso.state==='closed') audioCondiviso = new AudioContext()
      const ctx = audioCondiviso
      ctx.onstatechange = () => setAudioAttivo(ctx.state==='running')
      await ctx.resume(); setAudioAttivo(ctx.state==='running'); suona()
    }
    catch { setAvviso('Audio non disponibile: controlla lo schermo per i nuovi ordini.') }
  }
  const inizia = async () => {
    setIniziato(true)
    try { sessionStorage.setItem('ds_turno','iniziato') } catch { /* Stato in memoria. */ }
    void salvaPostazione()
    await attivaAudio()
  }
  if (!iniziato) return <div className="b-inizio"><div className="b-inizio__riquadro">
    <div className="b-inizio__testa"><span className="b-num b-secondario" suppressHydrationWarning>{new Date().toLocaleString('it-IT',{ weekday: 'long',day: 'numeric',month: 'long',hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</span>
      <h2 className="b-inizio__titolo">Buon turno</h2><p className="b-secondario">Prima di cominciare il tablet deve poter suonare e restare acceso.</p></div>
    <ul className="b-inizio__voci">
      <li><strong>Suono per i nuovi ordini</strong><span className="b-secondario">{SUONI[scelta]}</span></li>
      <li><strong>Schermo sempre acceso</strong><span className="b-secondario">Il tablet non va in standby durante il turno</span></li>
    </ul>
    <fieldset className="b-scelte b-inizio__postazioni"><legend className="b-occhiello">Questo dispositivo è</legend>
      {POSTAZIONI.map(p => <label key={p} className="b-scelta"><input type="radio" name="postazione" value={p} checked={scelta === p} onChange={() => setScelta(p)} />{ETICHETTA_POSTAZIONE[p]}</label>)}
    </fieldset>
    <p className="b-nascosto">Attiva suono e schermo sempre acceso</p>
    <button type="button" className="b-btn b-btn--principale b-btn--grande" onClick={inizia}>Inizia turno</button>
    {scelta === 'cassa' && <p className="b-secondario b-piccolo b-inizio__nota">Gli ordini online di stasera si aprono dopo, dalla barra in alto.</p>}
    {uscita}
  </div></div>
  return <SuonoTurno.Provider value={suona}>{!audioAttivo && <div className="b-avviso b-avviso--accettare b-staff__avviso"><p>Il suono è sospeso: senza, i nuovi ordini non suonano.</p><button type="button" className="b-btn b-btn--secondario" onClick={attivaAudio}>Riattiva suono</button></div>}{avviso && <p role="status" className="b-avviso b-staff__avviso">{avviso}</p>}{children}</SuonoTurno.Provider>
}
