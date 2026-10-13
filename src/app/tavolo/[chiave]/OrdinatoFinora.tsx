import { formatEuro } from '@/domain/soldi'
import { etichettaStato } from '@/domain/stati-tavolo'
import type { OrdineClient } from '@/tavoli/ordini-repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { EtichettaStato } from '@/componenti/EtichettaStato'
export function OrdinatoFinora({ ordini }: { ordini: OrdineClient[] }) {
  const totale = ordini.filter(o => o.stato !== 'annullato').reduce((s,o) => s + o.totaleCent,0)
  return <section id="ordinato" className="b-ordinato" aria-labelledby="ordinato-titolo">
    <h2 id="ordinato-titolo" className="b-titolo-2">Ordinato finora</h2>
    <p className="b-secondario">{ordini.length ? 'Qui vedi gli ordini mandati da tutti i telefoni del tavolo.' : 'Qui vedrai gli ordini inviati da tutti i telefoni del tavolo.'}</p>
    {ordini.map(o => <article className="b-card" key={o.id}>
      <div className="b-ordinato__testa"><h3 className="b-titolo-3">Ordine <span className="b-num">n. {o.numero}</span></h3><EtichettaStato stato={o.stato} testo={etichettaStato(o.stato)} /></div>
      <p className="b-num b-secondario b-piccolo">Mandato alle <time dateTime={o.creatoIl}>{new Date(o.creatoIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</time></p>
      <DettaglioRighe righe={o.righe} area="tavolo" />
    </article>)}
    <div className="b-ordinato__totale"><div><p>Totale del tavolo finora</p><p className="b-piccolo">Il conto lo fai alla cassa</p></div><span className="b-num">{formatEuro(totale)}</span></div>
  </section>
}
