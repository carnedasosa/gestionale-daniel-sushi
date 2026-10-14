'use client'
import { useEffect, useRef } from 'react'

const VARIABILE = '--b-barra-altezza'
/** Tiene `--b-barra-altezza` sulla radice pari all'altezza di `barra` (che cresce col testo e va a capo); restituisce lo stacco. */
export function seguiAltezza(barra: HTMLElement, radice: HTMLElement, Osservatore: typeof ResizeObserver = ResizeObserver): () => void {
  const aggiorna = () => radice.style.setProperty(VARIABILE,`${Math.ceil(barra.getBoundingClientRect().height)}px`)
  const osservatore = new Osservatore(aggiorna)
  osservatore.observe(barra); aggiorna()
  return () => { osservatore.disconnect(); radice.style.removeProperty(VARIABILE) }
}

/** Barra fissa in basso (carrello, conferma): `main.b-con-barra` lascia sotto lo spazio della sua altezza misurata. */
export function BarraBasso({ children }: { children: React.ReactNode }) {
  const barra = useRef<HTMLDivElement>(null)
  useEffect(() => seguiAltezza(barra.current!,document.documentElement),[])
  return <div ref={barra} className="b-barra-basso"><div className="b-barra-basso__dentro">{children}</div></div>
}
