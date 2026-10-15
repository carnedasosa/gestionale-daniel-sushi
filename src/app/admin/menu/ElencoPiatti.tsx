'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { filtraCategorie, type CategoriaElenco } from '@/menu/elenco'
import { InterruttoreDisponibile, type CambiaDisponibilita } from '@/componenti/InterruttoreDisponibile'

export { filtraCategorie, type CategoriaElenco, type PiattoElenco } from '@/menu/elenco'
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
function useBarraCategorie(ids: string[]) {
  const testa = useRef<HTMLDivElement>(null), fila = useRef<HTMLElement>(null), pillole = useRef<HTMLDivElement>(null)
  const salto = useRef(false)
  const [attiva,setAttiva] = useState<string | null>(ids[0] ?? null)
  const [nascosta,setNascosta] = useState(false)
  const [coda,setCoda] = useState<ReturnType<typeof codaPillole>>()
  const chiave = ids.join(' ')
  useEffect(() => {
    const radice = document.documentElement, media = matchMedia(telefono)
    const barra = () => (media.matches ? fila.current : testa.current)
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

const Allergeni = ({ ok }: { ok: boolean }) => <span className={`b-etichetta ${ok ? 'b-etichetta--pronto' : 'b-etichetta--accettare'}`}>{ok ? 'Confermati' : 'Da confermare'}</span>
/** Elenco dei piatti dell'admin, con ricerca istantanea e interruttore della disponibilità. */
export function ElencoPiatti({ categorie,cambia }: { categorie: CategoriaElenco[]; cambia: CambiaDisponibilita }) {
  const [testo,setTesto] = useState('')
  const trovate = filtraCategorie(categorie,testo)
  const { testa:rifTesta,fila:rifFila,pillole:rifPillole,attiva,nascosta,coda,vai } = useBarraCategorie(trovate.map(c => c.id))
  return <>
    <div ref={rifTesta} className="b-elenco-testa">
      <label className="b-campo b-admin-cerca">Cerca un piatto<input type="search" value={testo} onChange={e => setTesto(e.target.value)} placeholder="Sake roll, 29…" /></label>
      {trovate.length > 0 && <nav ref={rifFila} aria-label="Vai alla categoria" className="b-elenco-categorie" data-nascosta={nascosta || undefined} data-coda={coda}>
        <div ref={rifPillole} className="b-pillole">{trovate.map(c => <a key={c.id} href={`#sez-${c.id}`} className="b-pillola" aria-current={attiva === c.id ? 'true' : undefined} onClick={e => vai(e,c.id)}>{c.nome}</a>)}</div>
      </nav>}
    </div>
    {!trovate.length && <p className="b-avviso">Nessun piatto trovato.</p>}
    {trovate.map(c => <section key={c.id} id={`sez-${c.id}`} className="b-admin-sezione b-admin-sezione--categoria" aria-labelledby={`cat-${c.id}`}>
      <div className="b-menu-sezione__testa"><h2 id={`cat-${c.id}`} className="b-titolo-2" tabIndex={-1}>{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      <div className="b-tabella-scorre" role="region" aria-label={`Piatti: ${c.nome}`} tabIndex={0}>
        <table className="b-tabella b-tabella-piatti">
          <thead><tr><th>N.</th><th>Piatto</th><th className="b-destra">Prezzo</th><th>Allergeni</th><th>Stasera</th><th><span className="b-nascosto">Azioni</span></th></tr></thead>
          <tbody>{c.piatti.map(p => <tr key={p.id} className={p.disponibile ? undefined : 'b-esaurito'}>
            <td className="b-num">{p.numero ?? '—'}</td><td><strong>{p.nome}</strong></td><td className="b-num b-destra">{formatEuro(p.prezzoCent)}</td>
            <td><Allergeni ok={p.allergeniConfermati} /></td><td><InterruttoreDisponibile id={p.id} nome={p.nome} disponibile={p.disponibile} cambia={cambia} /></td>
            <td className="b-destra"><Link href={`/admin/menu/${p.id}`}>Modifica<span className="b-nascosto"> {p.nome}</span></Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="b-lista b-righe-piatti">{c.piatti.map(p => <div key={p.id} className="b-riga-piatto">
        <Link href={`/admin/menu/${p.id}`} className="b-riga-piatto__testo"><strong>{p.numero !== null && <span className="b-num b-secondario">{p.numero} </span>}{p.nome}</strong>
          <span className="b-piccolo">{p.allergeniConfermati ? 'Allergeni confermati' : 'Allergeni da confermare'} · <span className="b-num">{formatEuro(p.prezzoCent)}</span></span></Link>
        <InterruttoreDisponibile id={p.id} nome={p.nome} disponibile={p.disponibile} cambia={cambia} />
      </div>)}</div>
    </section>)}
  </>
}
