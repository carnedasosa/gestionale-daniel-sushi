'use client'
import { useEffect, useRef, useState } from 'react'
import type { RigaCarrello } from '@/domain/carrello'
import type { SceltePoke } from '@/domain/poke'
import { aggiornaCarrello, ripristinaCarrello, type CarrelloSalvato } from '@/domain/carrello-salvato'
const VUOTO: CarrelloSalvato = { righe: [],chiaveInvio: null }
export const TROPPE_RIGHE = 'Puoi aggiungere al massimo 40 righe per ordine.'
/**
 * Carrello con chiave d'invio, salvato nel browser: `session` per il tavolo, `local` per gli ordini da casa.
 * Finché `bloccato.current` è vero (invio in corso) le modifiche vengono ignorate.
 */
export function useCarrelloSalvato(chiave: string, archivio: 'session' | 'local') {
  const [carrello,setCarrello] = useState<CarrelloSalvato>(VUOTO)
  const ref = useRef(carrello)
  const [caricato,setCaricato] = useState(false)
  const bloccato = useRef(false)
  const storage = () => archivio === 'local' ? localStorage : sessionStorage
  const imposta = (c: CarrelloSalvato) => {
    ref.current = c; setCarrello(c)
    try { storage().setItem(chiave,JSON.stringify(c)) } catch { /* Funziona anche in memoria. */ }
  }
  useEffect(() => {
    let iniziali = VUOTO
    try { iniziali = ripristinaCarrello((archivio === 'local' ? localStorage : sessionStorage).getItem(chiave) ?? '[]',() => crypto.randomUUID()); (archivio === 'local' ? localStorage : sessionStorage).setItem(chiave,JSON.stringify(iniziali)) } catch { /* Funziona anche solo in memoria. */ }
    ref.current = iniziali
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ripristino dello stato da storage esterno dopo l'hydration.
    setCarrello(iniziali)
    setCaricato(true)
  },[chiave,archivio])
  /** Applica una modifica alle righe; restituisce false se ignorata. */
  const modificaRighe = (fn: (r: RigaCarrello[]) => RigaCarrello[]): boolean => {
    if (bloccato.current || !caricato) return false
    imposta(aggiornaCarrello(ref.current,fn(ref.current.righe),() => crypto.randomUUID()))
    return true
  }
  /** Imposta la quantità di un piatto; restituisce un messaggio d'errore se non si può. */
  const modificaPiatto = (id: string, q: number): string | null => {
    const i = ref.current.righe.findIndex(r => r.piattoId === id)
    if (i === -1 && q > 0 && ref.current.righe.length >= 40) return TROPPE_RIGHE
    modificaRighe(r => q === 0 ? r.filter(v => v.piattoId !== id) : i === -1 ? [...r,{ piattoId: id,quantita: q,nota: '' }] : r.map((v,j) => j === i ? { ...v,quantita: q } : v))
    return null
  }
  const aggiungiPoke = (poke: SceltePoke): string | null => {
    if (ref.current.righe.length >= 40) return TROPPE_RIGHE
    modificaRighe(r => [...r,{ piattoId: null,quantita: 1,nota: '',poke }])
    return null
  }
  const svuota = () => imposta(VUOTO)
  /** Blocca le modifiche durante un invio; false se un invio è già in corso o il carrello non è pronto. */
  const blocca = (): boolean => {
    if (bloccato.current || !caricato || !ref.current.chiaveInvio) return false
    bloccato.current = true
    return true
  }
  const sblocca = () => { bloccato.current = false }
  return { carrello,ref,caricato,bloccato,imposta,modificaRighe,modificaPiatto,aggiungiPoke,svuota,blocca,sblocca }
}
