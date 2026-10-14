import Link from 'next/link'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { origineApp } from '@/domain/origine-app'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli } from '@/tavoli/repo'
import { ApriInPannello } from '@/componenti/ApriInPannello'
import { ModuloTavolo } from './ModuloTavolo'
export default async function TavoliAdmin() {
  await richiediRuolo('admin')
  // Un APP_URL sbagliato non deve impedire di gestire i tavoli: si nascondono solo i link e i QR.
  let origin: string | null = null
  try { origin = origineApp(await headers(),process.env.APP_URL) } catch { /* Avviso sotto. */ }
  const tavoli = await elencoTavoli(db)
  const qr = await Promise.all(tavoli.map(t => origin ? QRCode.toString(`${origin}/tavolo/${t.chiave}`,{ type: 'svg',margin: 0 }) : Promise.resolve(undefined)))
  return <>
    <div className="b-admin-testa">
      <div className="b-admin-testa__testi"><h1 className="b-titolo-1">Tavoli e QR</h1><p className="b-secondario">Ogni tavolo ha il suo QR, che resta lo stesso a ogni apertura. Il codice di 4 cifre lo dà il cameriere.</p></div>
      <div className="b-azioni"><Link href="/admin/tavoli/stampa" className="b-btn b-btn--secondario">Stampa i QR</Link>
        <ApriInPannello etichetta="Aggiungi tavolo" titolo="Aggiungi tavolo" classe="b-btn b-btn--principale"><ModuloTavolo /></ApriInPannello></div>
    </div>
    {!origin && <p className="b-avviso b-avviso--accettare">APP_URL non valido: correggilo per vedere e stampare i link dei QR.</p>}
    <div className="b-admin-griglia">{tavoli.map((t,i) => <ModuloTavolo key={t.id} tavolo={{ id: t.id,nome: t.nome,slug: t.slug,chiave: t.chiave,posizione: t.posizione,attivo: t.attivo }} url={origin ? `${origin}/tavolo/${t.chiave}` : undefined} qr={qr[i]} />)}</div>
  </>
}
