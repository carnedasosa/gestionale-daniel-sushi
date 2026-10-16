'use client'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ETICHETTA_POSTAZIONE, POSTAZIONI, schedePostazione, type Postazione } from '@/domain/postazioni'
import { Pannello } from '@/componenti/Pannello'
import { impostaPostazione } from './azioni-postazione'
import type { VistaStaff } from './vista'
const TESTO: Record<VistaStaff,string> = { ordini: 'Ordini',tavoli: 'Tavoli',conti: 'Conti',menu: 'Menù' }
const oraDi = (iso: string) => new Date(iso).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })
/** Scelta della postazione del dispositivo; dopo il salvataggio si torna a /staff senza `?postazione=`. */
export function SceltaPostazione({ attuale,uscita }: { attuale: Postazione; uscita?: React.ReactNode }) {
  const [aperto,setAperto] = useState(false)
  const [scelta,setScelta] = useState(attuale)
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const router = useRouter()
  const salva = () => startTransition(async () => {
    setErrore(null)
    try {
      const esito = await impostaPostazione(scelta)
      if (!esito.ok) { setErrore(esito.errore ?? 'Non riuscito, riprova.'); return }
      setAperto(false); router.replace('/staff'); router.refresh()
    } catch { setErrore('Non riuscito, riprova.') }
  })
  return <>
    <button type="button" className="b-staff-barra__bottone" onClick={() => { setScelta(attuale); setAperto(true) }}>Postazione…</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Postazione di questo dispositivo">
      <fieldset className="b-scelte b-scelte--colonna"><legend className="b-occhiello">Questo dispositivo è</legend>
        {POSTAZIONI.map(p => <label key={p} className="b-scelta"><input type="radio" name="postazione-barra" value={p} checked={scelta === p} onChange={() => setScelta(p)} />{ETICHETTA_POSTAZIONE[p]}</label>)}
      </fieldset>
      {errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
      <div className="b-azioni b-azioni--fine"><button type="button" className="b-btn b-btn--principale" disabled={inCorso} onClick={salva}>Usa questa postazione</button></div>
      {uscita && <div className="b-online__uscita">{uscita}</div>}
    </Pannello>
  </>
}
/**
 * Barra scura dello staff: schede della postazione, azioni (es. «Nuovo ordine»), stato degli ordini online (`online`), suono e ora.
 * Senza `vista` nessuna scheda è corrente. Con `uscita` mostra anche la scelta della postazione (che contiene «Esci»).
 */
export function BarraStaff({ vista,daGuardare,online,ora,suono,azioni,postazione = 'cassa',uscita }: { vista?: VistaStaff; daGuardare: number; online: React.ReactNode | null; ora: string; suono?: React.ReactNode; azioni?: React.ReactNode; postazione?: Postazione; uscita?: React.ReactNode }) {
  const [adesso,setAdesso] = useState(ora)
  useEffect(() => { const t = setInterval(() => setAdesso(new Date().toISOString()),30000); return () => clearInterval(t) },[])
  return <header className="b-staff-barra">
    <span className="b-staff-barra__marchio">Staff{postazione !== 'cassa' && <> · {ETICHETTA_POSTAZIONE[postazione]}</>}</span>
    <nav aria-label="Sezioni dello staff" className="b-staff-barra__schede">{schedePostazione(postazione).map(s => <Link key={s} href={`/staff?vista=${s}`} className="b-staff-barra__scheda" aria-current={s === vista ? 'page' : undefined}>
      {TESTO[s]}{s === 'ordini' && daGuardare > 0 && <span className="b-badge">{daGuardare}<span className="b-nascosto"> da guardare</span></span>}
    </Link>)}</nav>
    <span className="b-staff-barra__spazio" />
    {azioni}
    {online}
    {uscita !== undefined && <SceltaPostazione attuale={postazione} uscita={online ? undefined : uscita} />}
    {suono}
    <span className="b-num b-staff-barra__ora" aria-label={`Ora ${oraDi(adesso)}`}>{oraDi(adesso)}</span>
  </header>
}
