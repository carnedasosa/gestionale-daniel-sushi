'use client'
import { useState } from 'react'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, azioneAvanzaCasa, MOTIVI_RIFIUTO } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { Pannello } from '@/componenti/Pannello'
import type { EsitoStaff } from './azioni'
import { annullaRigaStaff } from './azioni'
import { accettaOrdineStaff, annullaOrdineCasaStaff, apriOrdiniOnline, avanzaOrdineCasaStaff, chiudiOrdiniOnline, rifiutaOrdineStaff } from './azioni-casa'
type Esegui = (azione: () => Promise<EsitoStaff>) => void
export interface OrdiniOnline { accesi: boolean; asporto: string | null; domicilio: string | null }
export function PannelloOrdiniOnline({ stato,inCorso,esegui }: { stato: OrdiniOnline; inCorso: boolean; esegui: Esegui }) {
  return <section className="ds-card staff-online" aria-labelledby="ordini-online"><h2 id="ordini-online" className="heading-sm">Ordini online: {stato.accesi ? 'aperti oggi' : 'chiusi'}</h2>
    {stato.accesi && <ul className="staff-online-stato"><li>Asporto: {stato.asporto ?? 'si può ordinare'}</li><li>Domicilio: {stato.domicilio ?? 'si può ordinare'}</li></ul>}
    {stato.accesi ? <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(chiudiOrdiniOnline)}>Chiudi ordini online</button>
      : <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(apriOrdiniOnline)}>Apri ordini di oggi</button>}
  </section>
}
function RifiutaOrdine({ ordine,inCorso,esegui }: { ordine: OrdineCasaClient; inCorso: boolean; esegui: Esegui }) {
  const [aperto,setAperto] = useState(false)
  const [motivo,setMotivo] = useState('')
  const [altro,setAltro] = useState('')
  return <>
    <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => setAperto(true)}>Rifiuta</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo={`Rifiuta l’ordine n. ${ordine.numero}`}>
      <fieldset className="staff-motivi"><legend>Motivo, che il cliente leggerà</legend>
        {[...MOTIVI_RIFIUTO,'Altro'].map(m => <label key={m}><input type="radio" name={`motivo-${ordine.id}`} value={m} checked={motivo === m} onChange={() => setMotivo(m)} />{m}</label>)}
      </fieldset>
      {motivo === 'Altro' && <label className="campo">Scrivi il motivo<textarea maxLength={200} rows={2} value={altro} onChange={e => setAltro(e.target.value)} /></label>}
      <div className="conferma-azioni">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAperto(false)}>Annulla</button>
        <button type="button" className="ds-btn ds-btn--destructive" disabled={inCorso || !motivo || (motivo === 'Altro' && !altro.trim())} onClick={() => { setAperto(false); esegui(() => rifiutaOrdineStaff(ordine.id,motivo,altro)) }}>Rifiuta ordine</button>
      </div>
    </Pannello>
  </>
}
/** Ordine da casa: `daAccettare` mostra accetta/rifiuta, altrimenti i passaggi della cucina. */
export function CardOrdineCasa({ ordine: o,ora,inCorso,esegui,daAccettare }: { ordine: OrdineCasaClient; ora: string; inCorso: boolean; esegui: Esegui; daAccettare: boolean }) {
  const lunga = daAccettare && attesaLunga(o.creatoIl,new Date(ora))
  const avanza = azioneAvanzaCasa(o.tipo,o.stato)
  return <article className={`ds-card staff-ordine${daAccettare ? ' staff-ordine--nuovo' : ''}${lunga ? ' staff-ordine--attesa' : ''}`}>
    <h3 className="heading-sm">{o.tipo === 'domicilio' ? 'Domicilio' : 'Asporto'} {oraRoma(new Date(o.fascia))} · n. {o.numero}</h3>
    {lunga && <p className="staff-nota"><strong>In attesa da più di 10 minuti</strong></p>}
    <p>{o.clienteNome} · {o.clienteTelefono && <a className="ds-link" href={`tel:${o.clienteTelefono}`}>{o.clienteTelefono}</a>} · {formatEuro(o.totaleCent)} · {o.pagamento === 'carta' ? 'Carta' : `Contanti${o.contantiDaCent ? ` (paga con ${formatEuro(o.contantiDaCent)})` : ''}`}</p>
    {o.tipo === 'domicilio' && <p className="staff-nota">{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}{o.consegnaCent > 0 && ` · consegna ${formatEuro(o.consegnaCent)}`}</p>}
    <DettaglioRighe righe={o.righe} area="staff" azioneRiga={daAccettare ? undefined : r => <ConfermaAzione inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => esegui(() => annullaRigaStaff(r.id))}>Annulla<span className="visually-hidden"> {r.nome}</span></ConfermaAzione>} />
    <div className="staff-azioni">{daAccettare ? <>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,0))}>Accetta</button>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,15))}>Accetta +15’</button>
      <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,30))}>Accetta +30’</button>
      <RifiutaOrdine ordine={o} inCorso={inCorso} esegui={esegui} />
    </> : <>
      {avanza && <button type="button" className="ds-btn ds-btn--secondary" disabled={inCorso} onClick={() => esegui(() => avanzaOrdineCasaStaff(o.id,o.stato))}>{avanza}</button>}
      <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}? Il cliente riceverà un’email.`} conferma={() => esegui(() => annullaOrdineCasaStaff(o.id))}>Annulla ordine</ConfermaAzione>
    </>}</div>
  </article>
}
