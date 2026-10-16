'use client'
import { useEffect, useRef, useState } from 'react'
import { arriviCucina, leggiStatoArrivi, segnaLetto, type StatoArrivi } from '@/domain/arrivi-cucina'

function salvati(chiave: string): StatoArrivi | null {
  try { return leggiStatoArrivi(sessionStorage.getItem(chiave)) } catch { return null }
}
function salva(chiave: string, stato: StatoArrivi) {
  try { sessionStorage.setItem(chiave,JSON.stringify(stato)) } catch { /* Senza storage la memoria resta solo in questa pagina. */ }
}
/**
 * Elementi comparsi da quando la scheda li ha visti l'ultima volta (memoria in sessionStorage sotto `chiave`).
 * `arrivo` riceve i nuovi id a ogni aggiornamento; `nuovi` restano evidenziati finché non si segnano letti.
 */
export function useArrivi(chiave: string, ids: string[] | undefined, arrivo: (arrivati: string[]) => void): { nuovi: string[]; leggi: (id: string) => void } {
  const [nuovi,setNuovi] = useState<string[]>([])
  // undefined = non ancora letto da sessionStorage; null = primo avvio del turno in questa scheda.
  const stato = useRef<StatoArrivi | null | undefined>(undefined)
  const elenco = ids?.join(',')
  const ultimoArrivo = useRef(arrivo)
  useEffect(() => { ultimoArrivo.current = arrivo })
  useEffect(() => {
    if (elenco === undefined) return
    if (stato.current === undefined) stato.current = salvati(chiave)
    const esito = arriviCucina(stato.current,elenco ? elenco.split(',') : [])
    stato.current = esito.stato; salva(chiave,esito.stato)
    setNuovi(esito.stato.nuovi)
    if (esito.arrivati.length) ultimoArrivo.current(esito.arrivati)
  },[elenco,chiave])
  const leggi = (id: string) => {
    if (!stato.current) return
    stato.current = segnaLetto(stato.current,id); salva(chiave,stato.current)
    setNuovi(stato.current.nuovi)
  }
  return { nuovi,leggi }
}
