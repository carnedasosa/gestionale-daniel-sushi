import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import './admin.css'

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await richiediRuolo('admin')
  return (
    <div className="admin">
      <header className="admin__barra">
        <strong className="heading-sm">Gestionale</strong>
        <nav className="admin__nav">
          <Link href="/admin/menu" className="ds-link">Menù</Link>
          <Link href="/admin/tavoli" className="ds-link">Tavoli</Link>
          <Link href="/admin/poke" className="ds-link">Poke</Link>
          <Link href="/admin/domicilio" className="ds-link">Domicilio</Link>
          <Link href="/staff" className="ds-link">Schermo staff</Link>
          <Link href="/" className="ds-link">Vedi il menù pubblico</Link>
        </nav>
        <form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form>
      </header>
      <main className="contenitore admin__contenuto">{children}</main>
    </div>
  )
}
