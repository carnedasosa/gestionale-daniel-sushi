import Link from 'next/link'
import { notFound } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { contoSessione } from '@/tavoli/ordini-repo'
import { formatEuro } from '@/domain/soldi'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { ChiudiTavolo } from '../../ChiudiTavolo'
import { VoceConto } from '../../VoceConto'
import '../../staff.css'
export default async function ContoPage({ params }: { params: Promise<{ sessione: string }> }) {
  await richiediRuolo('staff')
  const { sessione } = await params
  const conto = await contoSessione(db,sessione)
  if (!conto) notFound()
  return <main className="contenitore staff-pagina"><Link className="ds-link staff-navigazione" href="/staff">Torna allo schermo</Link>
    <h1 className="heading">Conto · {conto.tavoloNome}</h1><p>Aperto il {conto.apertaIl.toLocaleString('it-IT',{ timeZone: 'Europe/Rome' })}{conto.chiusaIl && ` · chiuso il ${conto.chiusaIl.toLocaleString('it-IT',{ timeZone: 'Europe/Rome' })}`}</p>
    {conto.chiusaIl ? <p role="status">Tavolo chiuso alle {conto.chiusaIl.toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</p> : <AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={conto.vistoAlle.toISOString()} />}
    <table className="staff-conto"><caption className="visually-hidden">Riepilogo del tavolo</caption><thead><tr><th>N.</th><th>Piatto</th><th>Quantità</th><th>Importo</th></tr></thead><tbody>{conto.voci.map(v => <VoceConto key={JSON.stringify([v.numero,v.nome,v.prezzoUnitCent,v.poke])} sessioneId={sessione} voce={v} />)}</tbody></table>
    <p className="heading">Totale: {formatEuro(conto.totaleCent)}</p><p>Da battere in cassa: questo non è uno scontrino fiscale.</p>
    {!conto.chiusaIl && <div className="staff-navigazione"><ChiudiTavolo sessioneId={sessione} contoVistoAlle={conto.vistoAlle.toISOString()} primaria /></div>}
  </main>
}
