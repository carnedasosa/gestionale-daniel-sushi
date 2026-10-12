import Link from 'next/link'
import { headers } from 'next/headers'
import { origineApp } from '@/domain/origine-app'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli } from '@/tavoli/repo'
import { ModuloTavolo } from './ModuloTavolo'
export default async function TavoliAdmin() {
  await richiediRuolo('admin')
  // Un APP_URL sbagliato non deve impedire di gestire i tavoli: si nascondono solo i link.
  let origin: string | null = null
  try { origin = origineApp(await headers(),process.env.APP_URL) } catch { /* Avviso sotto. */ }
  const tavoli = await elencoTavoli(db)
  return <><h1 className="heading">Tavoli</h1><p>Il QR resta lo stesso a ogni apertura. Il cameriere comunica il nuovo codice.</p><Link href="/admin/tavoli/stampa" className="ds-btn ds-btn--secondary">Stampa i QR</Link>
    {!origin && <p className="admin-avviso">APP_URL non valido: correggilo per vedere e stampare i link dei QR.</p>}
    <ModuloTavolo /><div className="admin-tavoli">{tavoli.map(t => <ModuloTavolo key={t.id} tavolo={{ id: t.id,nome: t.nome,slug: t.slug,chiave: t.chiave,posizione: t.posizione,attivo: t.attivo }} url={origin ? `${origin}/tavolo/${t.chiave}` : undefined} />)}</div></>
}
