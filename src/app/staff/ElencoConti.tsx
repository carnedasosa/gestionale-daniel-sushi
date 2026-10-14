import Link from 'next/link'
import { formatEuro } from '@/domain/soldi'
const ora = (iso: string) => new Date(iso).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })
/** Tavoli aperti e chiusi da poco: ognuno porta al suo conto. */
export function ElencoConti({ aperti,recenti,corrente }: { aperti: { id: string; nome: string; totaleCent: number }[]; recenti: { id: string; nome: string; chiusaIl: string }[]; corrente: string | null }) {
  return <nav aria-label="Conti" className="b-elenco-conti">
    <h2 className="b-occhiello">Tavoli aperti</h2>
    {!aperti.length && <p className="b-secondario">Nessun tavolo aperto.</p>}
    {aperti.map(c => <Link key={c.id} href={`/staff/conto/${c.id}`} className="b-elenco-conti__voce" aria-current={c.id === corrente ? 'page' : undefined}><span>{c.nome}</span><span className="b-num">{formatEuro(c.totaleCent)}</span></Link>)}
    <h2 className="b-occhiello b-elenco-conti__sezione">Chiusi nelle ultime 6 ore</h2>
    {!recenti.length && <p className="b-secondario">Nessun tavolo chiuso nelle ultime 6 ore.</p>}
    {recenti.map(c => <Link key={c.id} href={`/staff/conto/${c.id}`} className="b-elenco-conti__voce b-elenco-conti__voce--chiuso" aria-current={c.id === corrente ? 'page' : undefined}><span>{c.nome}</span><span className="b-num b-secondario">chiuso {ora(c.chiusaIl)}</span></Link>)}
  </nav>
}
