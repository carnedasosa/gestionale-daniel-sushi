'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EsitoStaff } from './azioni'

export type Esegui = (azione: () => Promise<EsitoStaff>) => void
/** Esegue un'azione dello staff alla volta (un doppio tocco non parte due volte), mostra l'errore e riaggiorna lo schermo. */
export function useEsegui(): { esegui: Esegui; inCorso: boolean; errore: string | null } {
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const bloccato = useRef(false)
  const router = useRouter()
  const esegui: Esegui = azione => {
    if (bloccato.current) return
    bloccato.current = true; setErrore(null)
    startTransition(async () => {
      try { const esito = await azione(); if (!esito.ok) setErrore(esito.errore ?? 'Operazione non riuscita, riprova.'); router.refresh() }
      catch { setErrore('Operazione non riuscita, riprova.') }
      finally { bloccato.current = false }
    })
  }
  return { esegui,inCorso,errore }
}

/** Ultimi dati ricevuti: se una lettura dal DB fallisce lo schermo resta montato con questi (suono e ordini visti non si perdono). */
export function useUltimiDati<T>(dati: T | null): T | null {
  const [ultimi,setUltimi] = useState(dati)
  if (dati && dati !== ultimi) setUltimi(dati)
  return dati ?? ultimi
}
