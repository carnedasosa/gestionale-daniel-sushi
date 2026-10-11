import Link from 'next/link'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli } from '@/tavoli/repo'
export default async function StampaTavoli() {
  await richiediRuolo('admin')
  const h = await headers()
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() === 'http' ? 'http' : 'https'
  const origin = new URL(process.env.APP_URL || `${proto}://${h.get('host') ?? ''}`)
  if (!['https:','http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('APP_URL non valido')
  const tavoli = (await elencoTavoli(db)).filter(t => t.attivo)
  const qr = await Promise.all(tavoli.map(t => QRCode.toString(`${origin.origin}/tavolo/${t.slug}`,{ type: 'svg',margin: 1 })))
  return <><div className="admin-stampa-nav"><h1 className="heading">QR dei tavoli</h1><p>Stampa dal browser in formato A4. Quattro tavoli per pagina.</p><Link href="/admin/tavoli" className="ds-link">Torna ai tavoli</Link></div>
    {!tavoli.length && <p>Nessun tavolo attivo da stampare.</p>}
    <div className="admin-qr-griglia">{tavoli.map((t,i) => <article className="admin-qr-card" key={t.id}><h2 className="heading">{t.nome}</h2><div className="admin-qr" role="img" aria-label={`QR per ${t.nome}`} dangerouslySetInnerHTML={{ __html: qr[i] }} /><p>Inquadra per ordinare · il codice te lo dà il cameriere</p><p className="admin-qr-url">{origin.origin}/tavolo/{t.slug}</p></article>)}</div>
  </>
}
