import { notFound } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { contoSessione, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { contiRecenti, elencoTavoli } from '@/tavoli/repo'
import { formatEuro } from '@/domain/soldi'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { BarraStaff } from '../../BarraStaff'
import { ElencoConti } from '../../ElencoConti'
import { Stampa } from '../../Stampa'
import { ChiusuraConto } from '../../ChiusuraConto'
import { VoceConto } from '../../VoceConto'
import { Coperti } from '../../Coperti'
import '../../staff.css'
const quando = (d: Date) => d.toLocaleString('it-IT',{ day: '2-digit',month: '2-digit',hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })
export default async function ContoPage({ params }: { params: Promise<{ sessione: string }> }) {
  await richiediRuolo('staff')
  const { sessione } = await params
  const conto = await contoSessione(db,sessione)
  if (!conto) notFound()
  const [tavoli,riepiloghi,recenti] = await Promise.all([elencoTavoli(db),riepiloghiTavoli(db),contiRecenti(db)])
  const aperti = tavoli.filter(t => t.sessione).map(t => ({ id: t.sessione!.id,nome: t.nome,totaleCent: riepiloghi.find(r => r.sessioneId === t.sessione!.id)?.totaleCent ?? 0 }))
  return <main className="b-staff">
    <BarraStaff vista="conti" daGuardare={0} online={null} ora={new Date().toISOString()} />
    <div className="b-staff__vista"><div className="b-conti">
      <ElencoConti aperti={aperti} recenti={recenti.map(c => ({ id: c.id,nome: c.tavoloNome,chiusaIl: c.chiusaIl.toISOString() }))} corrente={sessione} />
      <section className="b-conto" aria-labelledby="titolo-conto">
        <div className="b-conto__testa">
          <div><p className="b-num b-secondario b-piccolo">aperto il {quando(conto.apertaIl)}{conto.chiusaIl && ` · chiuso il ${quando(conto.chiusaIl)}`}</p><h1 id="titolo-conto" className="b-titolo-1">Conto · {conto.tavoloNome}</h1></div>
          <Stampa />
        </div>
        {conto.chiusaIl ? <p role="status" className="b-avviso b-avviso--pronto">Tavolo chiuso alle {conto.chiusaIl.toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</p> : <AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={conto.vistoAlle.toISOString()} />}
        <div className="b-tabella-scorre"><table className="b-tabella b-conto__tabella"><caption className="b-nascosto">Voci del conto</caption>
          <thead><tr><th>N.</th><th>Piatto</th><th className="b-destra">Q.tà</th><th className="b-destra">Importo</th></tr></thead>
          <tbody>{conto.voci.map(v => <VoceConto key={JSON.stringify([v.numero,v.nome,v.prezzoUnitCent,v.poke])} sessioneId={sessione} voce={v} modificabile={!conto.chiusaIl} />)}
            {conto.copertiCent > 0 && <tr><td className="b-num b-secondario">—</td><td><span className="b-conto__piatto">Coperto</span> <span className="b-secondario b-num">{formatEuro(conto.copertoCent!)}</span></td><td className="b-num b-destra">{conto.coperti}</td><td className="b-num b-destra">{formatEuro(conto.copertiCent)}</td></tr>}</tbody></table></div>
        {conto.chiusaIl ? conto.coperti !== null && <p className="b-secondario">Coperti: <span className="b-num">{conto.coperti}</span></p> : <div className="b-conto__coperti"><Coperti sessioneId={sessione} coperti={conto.coperti} /></div>}
        <div className="b-conto__piede">
          <div><p className="b-secondario">Da battere in cassa · non è uno scontrino fiscale</p><p className="b-num b-conto__totale" aria-label={`Totale: ${formatEuro(conto.totaleCent)}`}>{formatEuro(conto.totaleCent)}</p></div>
          {!conto.chiusaIl && <ChiusuraConto sessioneId={sessione} attuale={{ vistoAlle: conto.vistoAlle.toISOString(),ordiniIds: conto.ordiniIds,totaleCent: conto.totaleCent }} />}
        </div>
      </section>
    </div></div>
  </main>
}
