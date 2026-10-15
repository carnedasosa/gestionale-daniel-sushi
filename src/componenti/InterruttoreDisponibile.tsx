'use client'
import { useOptimistic, useState, useTransition } from 'react'
import type { EsitoDisponibilita } from '@/menu/cambia-disponibilita'

export type CambiaDisponibilita = (id: string, disponibile: boolean) => Promise<EsitoDisponibilita>
const ERRORE = 'Salvataggio non riuscito: controlla la connessione e riprova.'

/**
 * Interruttore Disponibile/Esaurito. Cambia subito al tocco e mostra «salvo…» finché il server risponde;
 * se il salvataggio fallisce torna allo stato vero e spiega perché, così nessuno crede esaurito un piatto che non lo è.
 */
export function InterruttoreDisponibile({ id,nome,disponibile,cambia }: { id: string; nome: string; disponibile: boolean; cambia: CambiaDisponibilita }) {
  const [mostrato,imposta] = useOptimistic(disponibile)
  const [inCorso,startTransition] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const tocca = () => {
    if (inCorso) return
    setErrore(null)
    startTransition(async () => {
      imposta(!disponibile)
      try { const e = await cambia(id,!disponibile); if (!e.ok) setErrore(e.errore) }
      catch { setErrore(ERRORE) }
    })
  }
  return <div className="b-interruttore-campo">
    <button type="button" className="b-interruttore" role="switch" aria-checked={mostrato} aria-busy={inCorso || undefined} onClick={tocca}>
      <span className="b-nascosto">{nome}: </span><span className="b-interruttore__binario" aria-hidden="true" />{mostrato ? 'Disponibile' : 'Esaurito'}
      {inCorso && <span className="b-interruttore__stato">salvo…</span>}
    </button>
    {errore && <p role="alert" className="b-errore">{errore}</p>}
  </div>
}
