import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli } from '@/tavoli/repo'
import { ModuloTavolo } from './ModuloTavolo'
export default async function TavoliAdmin() {
  await richiediRuolo('admin')
  const tavoli = await elencoTavoli(db)
  return <><h1 className="heading">Tavoli</h1><p>Il QR resta lo stesso a ogni apertura. Il cameriere comunica il nuovo codice.</p><Link href="/admin/tavoli/stampa" className="ds-btn ds-btn--secondary">Stampa i QR</Link>
    <ModuloTavolo /><div className="admin-tavoli">{tavoli.map(t => <ModuloTavolo key={t.id} tavolo={{ id: t.id,nome: t.nome,slug: t.slug,posizione: t.posizione,attivo: t.attivo }} />)}</div></>
}
