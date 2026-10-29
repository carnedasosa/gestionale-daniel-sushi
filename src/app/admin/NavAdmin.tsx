'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Pannello } from '@/componenti/Pannello'
import { seguiAltezza } from '@/componenti/BarraBasso'

const ICONE: Record<string,React.ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h10" />,
  poke: <path d="M3 11h18a9 9 0 0 1-18 0Z" />,
  tavoli: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2z" /></>,
  domicilio: <path d="M3 11 12 4l9 7v9H3z" />,
  cassa: <><rect x="6" y="3" width="12" height="7" rx="1" /><rect x="3" y="10" width="18" height="8" rx="2" /><path d="M7 18v3h10v-3" /></>,
  altro: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
}
const Icona = ({ nome }: { nome: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONE[nome]}</svg>

/** Navigazione dell'admin: barra laterale su computer, barra in basso su telefono. La sezione corrente è evidenziata. */
export function NavAdmin({ daConfermare,uscita }: { daConfermare: number; uscita: React.ReactNode }) {
  const percorso = usePathname()
  const [altro,setAltro] = useState(false)
  // Altezza vera della barra del telefono (0 quando è nascosta): l'admin.css lascia sopra il contenuto e la barra «salva».
  const basso = useRef<HTMLElement>(null)
  useEffect(() => seguiAltezza(basso.current!,document.documentElement,'--b-nav-altezza'),[])
  const voci = [
    { href: '/admin/menu',testo: 'Menù',breve: 'Menù',icona: 'menu',badge: daConfermare },
    { href: '/admin/poke',testo: 'Poke',breve: 'Poke',icona: 'poke',badge: 0 },
    { href: '/admin/tavoli',testo: 'Tavoli e QR',breve: 'Tavoli',icona: 'tavoli',badge: 0 },
    { href: '/admin/domicilio',testo: 'Domicilio e asporto',breve: 'Domicilio',icona: 'domicilio',badge: 0 },
    { href: '/admin/cassa',testo: 'Cassa e stampe',breve: 'Cassa',icona: 'cassa',badge: 0 },
  ]
  const attiva = (href: string) => percorso === href || percorso.startsWith(`${href}/`)
  const badge = (n: number) => n > 0 && <span className="b-badge">{n}<span className="b-nascosto"> piatti con allergeni da confermare</span></span>
  const esterni = <><Link href="/staff" className="b-nav-admin__esterno">Schermo staff <span aria-hidden="true">↗</span></Link><Link href="/" className="b-nav-admin__esterno">Menù dei clienti <span aria-hidden="true">↗</span></Link></>
  return <>
    <nav aria-label="Area admin" className="b-nav-admin">
      <div className="b-nav-admin__marchio"><span>Gestionale</span><span className="b-secondario b-piccolo">Daniel&apos;s Sushi</span></div>
      {voci.map(v => <Link key={v.href} href={v.href} className="b-nav-admin__voce" aria-current={attiva(v.href) ? 'page' : undefined}>{v.testo}{badge(v.badge)}</Link>)}
      <span className="b-nav-admin__filetto" />
      {esterni}
      <span className="b-nav-admin__spazio" />
      {uscita}
    </nav>
    <nav ref={basso} aria-label="Area admin (telefono)" className="b-nav-admin-basso">
      {voci.map(v => <Link key={v.href} href={v.href} className="b-nav-admin-basso__voce" aria-current={attiva(v.href) ? 'page' : undefined}><Icona nome={v.icona} />{v.breve}{v.badge > 0 && <span className="b-nav-admin-basso__punto" aria-label={`${v.badge} da confermare`} />}</Link>)}
      <button type="button" className="b-nav-admin-basso__voce" onClick={() => setAltro(true)}><Icona nome="altro" />Altro</button>
    </nav>
    <Pannello aperto={altro} chiudi={() => setAltro(false)} titolo="Altro"><div className="b-altre">{esterni}{uscita}</div></Pannello>
  </>
}
