import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, etichettaClienteCasa, passiOrdine } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
export const STATI_FINALI = ['rifiutato','annullato','completato'] as const
export function ordineConcluso(stato: string): boolean { return (STATI_FINALI as readonly string[]).includes(stato) }
const SPUNTA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
export function StatoOrdine({ ordine: o,telefono,ora }: { ordine: OrdineCasaClient; telefono: string | null; ora: string }) {
  if (o.anonimizzato) return <p className="b-avviso">Ordine non più disponibile.</p>
  const orario = oraRoma(new Date(o.fascia)), domicilio = o.tipo === 'domicilio'
  const chiama = telefono && <a href={`tel:${telefono}`}>{telefono}</a>
  const passi = passiOrdine(o.tipo,o.stato)
  return <>
    <div className="b-stato-ordine">
      <h1 className="b-num b-secondario b-stato-ordine__numero">Ordine n. {o.numero}</h1>
      <p className="b-titolo-1" role="status">{etichettaClienteCasa(o.tipo,o.stato)}</p>
      {o.stato === 'in_attesa' && <p className="b-stato-ordine__orario">Orario richiesto: <strong>{domicilio ? 'consegna verso le' : 'ritiro alle'} {orario}</strong></p>}
      {['accettato','in_preparazione','pronto','in_consegna'].includes(o.stato) && <p className="b-stato-ordine__orario"><strong>{domicilio ? `Consegna verso le ${orario}` : `Ritiro alle ${orario} in Via Beato Giacomo 72, Bitetto`}</strong></p>}
      {o.stato === 'rifiutato' && <p>Non possiamo accettare l’ordine{o.motivoRifiuto ? `: ${o.motivoRifiuto}` : '.'}</p>}
      {domicilio && o.indirizzo && <p className="b-secondario">{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}</p>}
    </div>
    {o.stato === 'in_attesa' && (attesaLunga(o.creatoIl,new Date(ora))
      ? <p className="b-avviso b-avviso--accettare">Non abbiamo ancora risposto: {chiama ? <>chiamaci al {chiama}.</> : 'chiama il locale.'}</p>
      : <p className="b-secondario">Aspettiamo la conferma del locale: questa pagina si aggiorna da sola.</p>)}
    {passi.length > 0 && <section className="b-card" aria-label="Avanzamento dell’ordine">
      <ol className="b-cronologia">{passi.map((p,i) => {
        const orarioPasso = i === 0 ? oraRoma(new Date(o.creatoIl)) : p.avanzamento === 'attuale' ? oraRoma(new Date(o.aggiornatoIl)) : null
        return <li key={p.stato} className={`b-cronologia__passo b-cronologia__passo--${p.avanzamento}`} aria-current={p.avanzamento === 'attuale' ? 'step' : undefined}>
          <span className="b-cronologia__segno">{p.avanzamento === 'fatto' && SPUNTA}</span>
          <span className="b-cronologia__testo">{p.etichetta}{p.avanzamento === 'fatto' && <span className="b-nascosto"> (fatto)</span>}</span>
          {orarioPasso && <span className="b-num b-secondario">{orarioPasso}</span>}
        </li>
      })}</ol>
    </section>}
    {o.stato !== 'in_attesa' && !ordineConcluso(o.stato) && <p className="b-secondario b-piccolo b-stato-ordine__vivo"><span className="b-punto b-punto--pronto" aria-hidden="true" />La pagina si aggiorna da sola.</p>}
    <section className="b-card" aria-labelledby="riepilogo-ordine"><h2 id="riepilogo-ordine" className="b-titolo-3">Riepilogo</h2>
      <DettaglioRighe righe={o.righe} area="tavolo" />
      <div className="b-scontrino">
        {o.consegnaCent > 0 && <div className="b-scontrino__riga b-secondario"><span>Consegna</span><span className="b-num">{formatEuro(o.consegnaCent)}</span></div>}
        <div className="b-scontrino__totale"><span>Totale</span><span className="b-num">{formatEuro(o.totaleCent)}</span></div>
      </div>
      <p className="b-secondario b-piccolo">Paghi {domicilio ? 'alla consegna' : 'al ritiro'} {o.pagamento === 'carta' ? 'con carta' : `in contanti${o.contantiDaCent ? ` (con ${formatEuro(o.contantiDaCent)})` : ''}`}.</p>
    </section>
    {telefono && <a className="b-btn b-btn--secondario b-btn--largo" href={`tel:${telefono}`}>Chiama il locale<span className="b-nascosto"> al {telefono}</span></a>}
  </>
}
