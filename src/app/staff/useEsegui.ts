'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EsitoStaff } from './azioni'

export type Esegui = (azione: () => Promise<EsitoStaff>) => void
/** Azioni di una card (o di un bottone a sé, come quelli degli ordini online): `inCorso` vale solo per quella chiave. */
export type AzioniDi = (chiave: string) => { inCorso: boolean; esegui: Esegui }
const ERRORE_GENERICO = 'Operazione non riuscita, riprova.'

export interface EffettiEsegui {
  /** Chiavi con un'azione in volo (copia nuova a ogni cambio, va bene come stato React). */
  inVolo: (chiavi: ReadonlySet<string>) => void
  errore: (messaggio: string | null) => void
  /** Riaggiorna lo schermo; non si aspetta: un aggiornamento appeso non deve tenere bloccati i bottoni. */
  aggiorna: () => void
}
/**
 * Esegue l'azione di una chiave, una alla volta per chiave (un doppio tocco sulla stessa card non parte due volte;
 * le altre card restano libere). Ordine: azione → la chiave torna libera → eventuale errore → aggiornamento.
 * Separata dall'hook per provarla senza DOM.
 */
export function eseguiAzione(chiave: string, azione: () => Promise<EsitoStaff>, bloccate: Set<string>, effetti: EffettiEsegui): void {
  if (bloccate.has(chiave)) return
  bloccate.add(chiave); effetti.inVolo(new Set(bloccate)); effetti.errore(null)
  void (async () => {
    let messaggio: string | null = null
    try { const esito = await azione(); if (!esito.ok) messaggio = esito.errore ?? ERRORE_GENERICO }
    catch { messaggio = ERRORE_GENERICO }
    bloccate.delete(chiave); effetti.inVolo(new Set(bloccate))
    if (messaggio) effetti.errore(messaggio)
    effetti.aggiorna()
  })()
}

/**
 * Azioni dello staff con lo stato «in corso» per chiave (id di ordine, comanda o tavolo): mentre si avanza un ordine
 * le altre card restano usabili. Il `router.refresh()` finale non sta nella transizione dell'azione
 * (Next lo avvia in una sua transizione): se resta appeso non disabilita nessun bottone.
 */
export function useEsegui(): { azioniDi: AzioniDi; errore: string | null } {
  const [errore,setErrore] = useState<string | null>(null)
  const [inVolo,setInVolo] = useState<ReadonlySet<string>>(() => new Set())
  const bloccate = useRef(new Set<string>())
  const router = useRouter()
  const effetti: EffettiEsegui = { inVolo: setInVolo,errore: setErrore,aggiorna: () => router.refresh() }
  const azioniDi: AzioniDi = chiave => ({ inCorso: inVolo.has(chiave),esegui: azione => eseguiAzione(chiave,azione,bloccate.current,effetti) })
  return { azioniDi,errore }
}

/** Ultimi dati ricevuti: se una lettura dal DB fallisce lo schermo resta montato con questi (suono e ordini visti non si perdono). */
export function useUltimiDati<T>(dati: T | null): T | null {
  const [ultimi,setUltimi] = useState(dati)
  if (dati && dati !== ultimi) setUltimi(dati)
  return dati ?? ultimi
}
