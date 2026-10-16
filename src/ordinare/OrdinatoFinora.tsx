import { formatEuro } from '@/domain/soldi'
import { etichettaStato } from '@/domain/stati-tavolo'
import { etichettaOrigine } from '@/domain/origine-ordine'
import type { OrdineClient } from '@/tavoli/ordini-repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { EtichettaStato } from '@/componenti/EtichettaStato'
/** Ordini del tavolo, dai telefoni dei clienti e dal cameriere. `vista`: a chi parla la pagina (il cliente chiude alla cassa, lo staff dai conti). */
export function OrdinatoFinora({ ordini,vista = 'cliente' }: { ordini: OrdineClient[]; vista?: 'cliente' | 'staff' }) {
  const totale = ordini.filter(o => o.stato !== 'annullato').reduce((s,o) => s + o.totaleCent,0)
  return <section id="ordinato" className="b-ordinato" aria-labelledby="ordinato-titolo">
    <h2 id="ordinato-titolo" className="b-titolo-2">Ordinato finora</h2>
    <p className="b-secondario">{vista === 'staff' ? 'Ordini del tavolo arrivati dai telefoni dei clienti e dal cameriere.' : ordini.length ? 'Qui vedi gli ordini mandati da tutti i telefoni del tavolo.' : 'Qui vedrai gli ordini inviati da tutti i telefoni del tavolo.'}</p>
    {ordini.map(o => <article className="b-card" key={o.id}>
      <div className="b-ordinato__testa"><h3 className="b-titolo-3">Ordine <span className="b-num">n. {o.numero}</span></h3><div className="b-ordinato__stato">{etichettaOrigine(o.origine) && <span className="b-etichetta">{etichettaOrigine(o.origine)}</span>}<EtichettaStato stato={o.stato} testo={etichettaStato(o.stato)} /></div></div>
      <p className="b-num b-secondario b-piccolo">Mandato alle <time dateTime={o.creatoIl}>{new Date(o.creatoIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</time></p>
      <DettaglioRighe righe={o.righe} area="tavolo" />
    </article>)}
    <div className="b-ordinato__totale"><div><p>Totale del tavolo finora</p><p className="b-piccolo">{vista === 'staff' ? 'Il conto si chiude dalla scheda Conti' : 'Il conto lo fai alla cassa'}</p></div><span className="b-num">{formatEuro(totale)}</span></div>
  </section>
}
