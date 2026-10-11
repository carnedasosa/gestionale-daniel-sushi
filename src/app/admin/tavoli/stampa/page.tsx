import Link from 'next/link'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { origineApp } from '@/domain/origine-app'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli } from '@/tavoli/repo'
export default async function StampaTavoli() {
  await richiediRuolo('admin')
  const h = await headers()
  const origin = origineApp(h,process.env.APP_URL)
  const tavoli = (await elencoTavoli(db)).filter(t => t.attivo)
  const qr = await Promise.all(tavoli.map(t => QRCode.toString(`${origin}/tavolo/${t.chiave}`,{ type: 'svg',margin: 1 })))
  return <><div className="admin-stampa-nav"><h1 className="heading">QR dei tavoli</h1><p>Stampa dal browser in formato A4. Quattro tavoli per pagina.</p><Link href="/admin/tavoli" className="ds-link">Torna ai tavoli</Link></div>
    {!process.env.APP_URL?.trim() && <p className="admin-avviso">Imposta APP_URL per stampare QR definitivi: ora uso {origin}</p>}
    {!tavoli.length && <p>Nessun tavolo attivo da stampare.</p>}
    <div className="admin-qr-griglia">{tavoli.map((t,i) => <article className="admin-qr-card" key={t.id}><h2 className="heading">{t.nome}</h2><div className="admin-qr" role="img" aria-label={`QR per ${t.nome}`} dangerouslySetInnerHTML={{ __html: qr[i] }} /><p>Inquadra per ordinare · il codice te lo dà il cameriere</p><p className="admin-qr-url">{origin}/tavolo/{t.chiave}</p></article>)}</div>
  </>
}
