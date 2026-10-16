'use client'
import { useOptimistic, useState, useTransition } from 'react'
import { ETICHETTA_REPARTO, REPARTI, repartoValido, type Reparto } from '@/domain/reparti'
import type { EsitoReparto } from './azioni'

export type CambiaReparto = (id: string, reparto: Reparto) => Promise<EsitoReparto>
const ERRORE = 'Salvataggio non riuscito: controlla la connessione e riprova.'

/**
 * Reparto che prepara una categoria. Cambia subito e mostra «salvo…» finché il server risponde;
 * se il salvataggio fallisce torna al reparto vero e spiega perché (stesso schema di InterruttoreDisponibile).
 */
export function SelettoreReparto({ id,nome,reparto,cambia }: { id: string; nome: string; reparto: Reparto; cambia: CambiaReparto }) {
  const [mostrato,imposta] = useOptimistic(reparto)
  const [inCorso,startTransition] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const scegli = (nuovo: string) => {
    if (inCorso || !repartoValido(nuovo) || nuovo === reparto) return
    setErrore(null)
    startTransition(async () => {
      imposta(nuovo)
      try { const e = await cambia(id,nuovo); if (!e.ok) setErrore(e.errore) }
      catch { setErrore(ERRORE) }
    })
  }
  const nota = `nota-reparto-${id}`
  return <div className="b-reparto-categoria">
    <label className="b-campo">
      <span>Reparto<span className="b-nascosto"> di {nome}</span>{inCorso && <span className="b-interruttore__stato"> salvo…</span>}</span>
      <select value={mostrato} onChange={e => scegli(e.target.value)} aria-describedby={nota} aria-busy={inCorso || undefined}>
        {REPARTI.map(r => <option key={r} value={r}>{ETICHETTA_REPARTO[r]}</option>)}
      </select>
    </label>
    <p id={nota} className="b-piccolo b-secondario">Chi prepara questa categoria. Vale per gli ordini da adesso.</p>
    {errore && <p role="alert" className="b-errore">{errore}</p>}
  </div>
}
