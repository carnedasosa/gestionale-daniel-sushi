'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { VistaStaff } from './vista'
const SCHEDE: { vista: VistaStaff; testo: string }[] = [{ vista: 'ordini',testo: 'Ordini' },{ vista: 'tavoli',testo: 'Tavoli' },{ vista: 'conti',testo: 'Conti' },{ vista: 'menu',testo: 'Menù' }]
const oraDi = (iso: string) => new Date(iso).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })
/** Barra scura dello staff: schede, stato degli ordini online (`online`), suono e ora. */
export function BarraStaff({ vista,daGuardare,online,ora,suono }: { vista: VistaStaff; daGuardare: number; online: React.ReactNode | null; ora: string; suono?: React.ReactNode }) {
  const [adesso,setAdesso] = useState(ora)
  useEffect(() => { const t = setInterval(() => setAdesso(new Date().toISOString()),30000); return () => clearInterval(t) },[])
  return <header className="b-staff-barra">
    <span className="b-staff-barra__marchio">Staff</span>
    <nav aria-label="Sezioni dello staff" className="b-staff-barra__schede">{SCHEDE.map(s => <Link key={s.vista} href={`/staff?vista=${s.vista}`} className="b-staff-barra__scheda" aria-current={s.vista === vista ? 'page' : undefined}>
      {s.testo}{s.vista === 'ordini' && daGuardare > 0 && <span className="b-badge">{daGuardare}<span className="b-nascosto"> da guardare</span></span>}
    </Link>)}</nav>
    <span className="b-staff-barra__spazio" />
    {online}
    {suono}
    <span className="b-num b-staff-barra__ora" aria-label={`Ora ${oraDi(adesso)}`}>{oraDi(adesso)}</span>
  </header>
}
