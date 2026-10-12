import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, etichettaClienteCasa } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
export const STATI_FINALI = ['rifiutato','annullato','completato'] as const
export function ordineConcluso(stato: string): boolean { return (STATI_FINALI as readonly string[]).includes(stato) }
export function StatoOrdine({ ordine: o,telefono,ora }: { ordine: OrdineCasaClient; telefono: string | null; ora: string }) {
  if (o.anonimizzato) return <p className="casa-avviso">Ordine non più disponibile.</p>
  const orario = oraRoma(new Date(o.fascia)), domicilio = o.tipo === 'domicilio'
  const chiama = telefono && <a className="ds-link" href={`tel:${telefono}`}>{telefono}</a>
  return <>
    <h1 className="heading">Ordine n. {o.numero}</h1>
    <section className="ds-card casa-sezione casa-stato" aria-live="polite">
      <p className="heading-sm" role="status">{etichettaClienteCasa(o.tipo,o.stato)}</p>
      {o.stato === 'in_attesa' && (attesaLunga(o.creatoIl,new Date(ora))
        ? <p className="casa-avviso">Non abbiamo ancora risposto: {chiama ? <>chiamaci al {chiama}.</> : 'chiama il locale.'}</p>
        : <p>Aspettiamo la conferma del locale: questa pagina si aggiorna da sola.</p>)}
      {o.stato === 'in_attesa' && <p>Orario richiesto: {domicilio ? 'consegna verso le' : 'ritiro alle'} {orario}</p>}
      {['accettato','in_preparazione','pronto','in_consegna'].includes(o.stato) && <p><strong>{domicilio ? `Consegna verso le ${orario}` : `Ritiro alle ${orario} in Via Beato Giacomo 72, Bitetto`}</strong></p>}
      {o.stato === 'rifiutato' && <p>Non possiamo accettare l’ordine{o.motivoRifiuto ? `: ${o.motivoRifiuto}` : '.'}</p>}
      {domicilio && o.indirizzo && <p>{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}</p>}
    </section>
    <section className="ds-card casa-sezione" aria-labelledby="riepilogo-ordine"><h2 id="riepilogo-ordine" className="heading-sm">Riepilogo</h2>
      <DettaglioRighe righe={o.righe} area="tavolo" />
      {o.consegnaCent > 0 && <p>Consegna: {formatEuro(o.consegnaCent)}</p>}
      <p className="casa-totale"><span>Totale</span><strong>{formatEuro(o.totaleCent)}</strong></p>
      <p>Paghi {domicilio ? 'alla consegna' : 'al ritiro'} {o.pagamento === 'carta' ? 'con carta' : `in contanti${o.contantiDaCent ? ` (con ${formatEuro(o.contantiDaCent)})` : ''}`}.</p>
    </section>
    {chiama && <p>Per qualsiasi domanda chiamaci al {chiama}.</p>}
  </>
}
