import { formatEuro } from '@/domain/soldi'
import { etichettaStato } from '@/domain/stati-tavolo'
import type { OrdineClient } from '@/tavoli/ordini-repo'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
export function OrdinatoFinora({ ordini }: { ordini: OrdineClient[] }) {
  const totale = ordini.filter(o => o.stato !== 'annullato').reduce((s,o) => s + o.totaleCent,0)
  return <section className="tavolo-ordinato" aria-labelledby="ordinato-titolo">
    <h2 id="ordinato-titolo" className="heading">Ordinato finora</h2>
    {!ordini.length && <p>Qui vedrai gli ordini inviati da tutti i telefoni del tavolo.</p>}
    {ordini.map(o => <article className="ds-card tavolo-ordine" key={o.id}>
      <h3 className="heading-sm">Ordine n. {o.numero}</h3><p><time dateTime={o.creatoIl}>{new Date(o.creatoIl).toLocaleTimeString('it-IT',{ hour: '2-digit',minute: '2-digit',timeZone: 'Europe/Rome' })}</time> · <span className="ds-badge">{etichettaStato(o.stato)}</span></p>
      <DettaglioRighe righe={o.righe} area="tavolo" />
    </article>)}
    <p className="heading-sm">Totale finora: {formatEuro(totale)}</p>
  </section>
}
