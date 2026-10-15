'use client'
import { useEffect, useRef, useState } from 'react'

/** Categoria che si sta guardando: l'ultima il cui titolo è già salito sotto la barra (altrimenti la prima). */
export function sezioneAttiva(sezioni: { id: string; top: number }[], soglia: number): string | null {
  let attiva = sezioni[0]?.id ?? null
  for (const s of sezioni) if (s.top <= soglia) attiva = s.id
  return attiva
}
/** Da che lato la fila delle categorie continua fuori vista (per la sfumatura). */
export function codaPillole(sinistra: number, larghezza: number, totale: number): 'destra' | 'sinistra' | 'entrambe' | undefined {
  const prima = sinistra > 1, dopo = sinistra + larghezza < totale - 1
  return prima && dopo ? 'entrambe' : prima ? 'sinistra' : dopo ? 'destra' : undefined
}
const telefono = '(max-width: 50em)'
const movimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** Fila delle categorie: evidenzia quella che si sta guardando; sul telefono si nasconde scorrendo in giù e ricompare risalendo. */
export function useBarraCategorie(ids: string[]) {
  const testa = useRef<HTMLDivElement>(null), fila = useRef<HTMLElement>(null), pillole = useRef<HTMLDivElement>(null)
  const salto = useRef(false)
  const [attiva,setAttiva] = useState<string | null>(ids[0] ?? null)
  const [nascosta,setNascosta] = useState(false)
  const [coda,setCoda] = useState<ReturnType<typeof codaPillole>>()
  const chiave = ids.join(' ')
  useEffect(() => {
    const radice = document.documentElement, media = matchMedia(telefono)
    const barra = () => (media.matches ? fila.current : testa.current ?? fila.current)
    // Altezza della parte che resta in alto: i titoli delle categorie si fermano subito sotto.
    const altezza = () => { const b = barra(); if (b) radice.style.setProperty('--b-categorie-altezza',`${Math.ceil(b.getBoundingClientRect().height)}px`) }
    const misura = new ResizeObserver(altezza)
    if (testa.current) misura.observe(testa.current)
    if (fila.current) misura.observe(fila.current)
    let ultimo = scrollY, attesa = 0
    const aggiorna = () => {
      attesa = 0
      const b = barra(); if (!b) return
      const sezioni = chiave.split(' ').map(id => ({ id,top: document.getElementById(`sez-${id}`)?.getBoundingClientRect().top ?? Infinity }))
      setAttiva(sezioneAttiva(sezioni,b.getBoundingClientRect().height + 24))
      const y = scrollY, dy = y - ultimo
      if (!media.matches || salto.current) { setNascosta(false); ultimo = y; return }
      if (Math.abs(dy) < 8) return
      // Si nasconde solo quando è già attaccata in cima, mai mentre è ancora al suo posto sotto la ricerca.
      if (dy > 0 && fila.current!.getBoundingClientRect().top <= 1) setNascosta(true)
      else if (dy < 0) setNascosta(false)
      ultimo = y
    }
    const scorri = () => { if (!attesa) attesa = requestAnimationFrame(aggiorna) }
    addEventListener('scroll',scorri,{ passive: true }); media.addEventListener('change',altezza)
    scorri()
    return () => { removeEventListener('scroll',scorri); media.removeEventListener('change',altezza); misura.disconnect(); cancelAnimationFrame(attesa); radice.style.removeProperty('--b-categorie-altezza') }
  },[chiave])
  // La pillola evidenziata resta in vista nella fila, anche quando le categorie sono più dello schermo.
  useEffect(() => {
    const c = pillole.current, p = c?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!c || !p) return
    const sc = c.getBoundingClientRect(), sp = p.getBoundingClientRect()
    c.scrollTo({ left: c.scrollLeft + sp.left - sc.left - (c.clientWidth - sp.width) / 2,behavior: movimento() })
  },[attiva])
  useEffect(() => {
    const c = pillole.current; if (!c) return
    const segna = () => setCoda(codaPillole(c.scrollLeft,c.clientWidth,c.scrollWidth))
    const misura = new ResizeObserver(segna); misura.observe(c)
    c.addEventListener('scroll',segna,{ passive: true })
    return () => { misura.disconnect(); c.removeEventListener('scroll',segna) }
  },[chiave])
  const vai = (e: React.MouseEvent, id: string) => {
    const sezione = document.getElementById(`sez-${id}`); if (!sezione) return
    e.preventDefault()
    // Durante il salto la fila resta visibile: si torna a nasconderla solo quando lo scorrimento è finito.
    salto.current = true; setNascosta(false); setAttiva(id)
    const fine = () => { clearTimeout(riserva); removeEventListener('scrollend',fine); setTimeout(() => { salto.current = false },150) }
    const riserva = setTimeout(fine,3000)
    addEventListener('scrollend',fine)
    sezione.scrollIntoView({ behavior: movimento(),block: 'start' })
    document.getElementById(`cat-${id}`)?.focus({ preventScroll: true })
  }
  return { testa,fila,pillole,attiva,nascosta,coda,vai }
}
type StatoFila = Omit<ReturnType<typeof useBarraCategorie>,'testa' | 'fila' | 'pillole'>

/** Fila di pillole che porta alle sezioni `sez-…`; riferimenti e stato vengono da useBarraCategorie. */
export function FilaCategorie({ categorie,rifFila,rifPillole,stato,className }: { categorie: { id: string; nome: string }[]; rifFila: React.Ref<HTMLElement>; rifPillole: React.Ref<HTMLDivElement>; stato: StatoFila; className?: string }) {
  return <nav ref={rifFila} aria-label="Vai alla categoria" className={`b-fila-categorie${className ? ` ${className}` : ''}`} data-nascosta={stato.nascosta || undefined} data-coda={stato.coda}>
    <div ref={rifPillole} className="b-pillole">{categorie.map(c => <a key={c.id} href={`#sez-${c.id}`} className="b-pillola" aria-current={stato.attiva === c.id ? 'true' : undefined} onClick={e => stato.vai(e,c.id)}>{c.nome}</a>)}</div>
  </nav>
}
