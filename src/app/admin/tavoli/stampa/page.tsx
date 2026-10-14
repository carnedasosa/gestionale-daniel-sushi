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
  return <><div className="b-admin-testa b-stampa-nav"><div className="b-admin-testa__testi"><h1 className="b-titolo-1">QR dei tavoli</h1><p className="b-secondario">Stampa dal browser in formato A4. Quattro tavoli per pagina.</p></div><Link href="/admin/tavoli" className="b-btn b-btn--secondario">Torna ai tavoli</Link></div>
    {!process.env.APP_URL?.trim() && <p className="b-avviso b-avviso--accettare">Imposta APP_URL per stampare QR definitivi: ora uso {origin}</p>}
    {!tavoli.length && <p>Nessun tavolo attivo da stampare.</p>}
    <div className="b-qr-griglia">{tavoli.map((t,i) => <article className="b-qr-card" key={t.id}><h2 className="b-titolo-1">{t.nome}</h2><div className="b-qr" role="img" aria-label={`QR per ${t.nome}`} dangerouslySetInnerHTML={{ __html: qr[i] }} /><p>Inquadra per ordinare · il codice te lo dà il cameriere</p><p className="b-link-qr">{origin}/tavolo/{t.chiave}</p></article>)}</div>
  </>
}
