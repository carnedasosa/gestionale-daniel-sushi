import Link from 'next/link'
import { notFound } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { contoSessione } from '@/tavoli/ordini-repo'
import { formatEuro } from '@/domain/soldi'
import '../../staff.css'
export default async function ContoPage({ params }: { params: Promise<{ sessione: string }> }) {
  await richiediRuolo('staff')
  const { sessione } = await params
  const conto = await contoSessione(db,sessione)
  if (!conto) notFound()
  return <main className="contenitore staff-pagina"><Link className="ds-link staff-navigazione" href="/staff">Torna allo schermo</Link>
    <h1 className="heading">Conto · {conto.tavoloNome}</h1><p>Aperto il {conto.apertaIl.toLocaleString('it-IT',{ timeZone: 'Europe/Rome' })}{conto.chiusaIl && ` · chiuso il ${conto.chiusaIl.toLocaleString('it-IT',{ timeZone: 'Europe/Rome' })}`}</p>
    <table className="staff-conto"><caption className="visually-hidden">Riepilogo del tavolo</caption><thead><tr><th>N.</th><th>Piatto</th><th>Quantità</th><th>Importo</th></tr></thead><tbody>{conto.voci.map((v,i) => <tr key={i}><td>{v.numero ?? '—'}</td><td>{v.nome}</td><td>{v.quantita}</td><td>{formatEuro(v.importoCent)}</td></tr>)}</tbody></table>
    <p className="heading">Totale: {formatEuro(conto.totaleCent)}</p><p>Da battere in cassa: questo non è uno scontrino fiscale.</p>
  </main>
}
