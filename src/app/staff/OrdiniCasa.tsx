'use client'
import { useState } from 'react'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import { attesaLunga, azioneAvanzaCasa, MOTIVI_RIFIUTO } from '@/domain/stati-casa'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { etichettaOrigine } from '@/domain/origine-ordine'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { AltreAzioni } from '@/componenti/AltreAzioni'
import { Pannello } from '@/componenti/Pannello'
import type { StatoReparto } from '@/comande/comande-repo'
import { ChipComande } from './DaPortare'
import { annullaRigaStaff } from './azioni'
import { accettaOrdineStaff, annullaOrdineCasaStaff, apriOrdiniOnline, avanzaOrdineCasaStaff, chiudiOrdiniOnline, rifiutaOrdineStaff } from './azioni-casa'
import type { Esegui } from './useEsegui'
export interface OrdiniOnline { accesi: boolean; asporto: string | null; domicilio: string | null }
/** Contenuto del pannello «Ordini online»: stato dei due servizi e interruttore della giornata. */
export function PannelloOrdiniOnline({ stato,inCorso,esegui }: { stato: OrdiniOnline; inCorso: boolean; esegui: Esegui }) {
  return <div className="b-online">
    {stato.accesi && <ul className="b-online__stato"><li>Asporto: {stato.asporto ?? 'si può ordinare'}</li><li>Domicilio: {stato.domicilio ?? 'si può ordinare'}</li></ul>}
    {stato.accesi ? <button type="button" className="b-btn b-btn--secondario b-btn--staff" disabled={inCorso} onClick={() => esegui(chiudiOrdiniOnline)}>Chiudi ordini online</button>
      : <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => esegui(apriOrdiniOnline)}>Apri ordini di oggi</button>}
  </div>
}
/** Bottone della barra con lo stato degli ordini online; apre il pannello (in fondo anche «Esci»). */
export function OrdiniOnlineBarra({ stato,inCorso,esegui,uscita }: { stato: OrdiniOnline; inCorso: boolean; esegui: Esegui; uscita?: React.ReactNode }) {
  const [aperto,setAperto] = useState(false)
  return <>
    <button type="button" className="b-staff-barra__bottone" onClick={() => setAperto(true)}><span className={`b-punto ${stato.accesi ? 'b-punto--pronto' : 'b-punto--spento'}`} aria-hidden="true" />{stato.accesi ? 'Ordini online aperti' : 'Ordini online chiusi'}</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo={`Ordini online: ${stato.accesi ? 'aperti oggi' : 'chiusi'}`}>
      <PannelloOrdiniOnline stato={stato} inCorso={inCorso} esegui={esegui} />
      {uscita && <div className="b-online__uscita">{uscita}</div>}
    </Pannello>
  </>
}
function RifiutaOrdine({ ordine,inCorso,esegui }: { ordine: OrdineCasaClient; inCorso: boolean; esegui: Esegui }) {
  const [aperto,setAperto] = useState(false)
  const [motivo,setMotivo] = useState('')
  const [altro,setAltro] = useState('')
  return <>
    <button type="button" className="b-btn b-btn--pericolo" disabled={inCorso} onClick={() => setAperto(true)}>Rifiuta…</button>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo={`Rifiuta l’ordine n. ${ordine.numero}`}>
      <fieldset className="b-scelte b-scelte--colonna"><legend className="b-occhiello">Motivo, che il cliente leggerà</legend>
        {[...MOTIVI_RIFIUTO,'Altro'].map(m => <label key={m} className="b-scelta"><input type="radio" name={`motivo-${ordine.id}`} value={m} checked={motivo === m} onChange={() => setMotivo(m)} />{m}</label>)}
      </fieldset>
      {motivo === 'Altro' && <label className="b-campo">Scrivi il motivo<textarea maxLength={200} rows={2} value={altro} onChange={e => setAltro(e.target.value)} /></label>}
      <div className="b-azioni b-azioni--fine">
        <button type="button" className="b-btn b-btn--secondario" onClick={() => setAperto(false)}>Annulla</button>
        <button type="button" className="b-btn b-btn--pieno-pericolo" disabled={inCorso || !motivo || (motivo === 'Altro' && !altro.trim())} onClick={() => { setAperto(false); esegui(() => rifiutaOrdineStaff(ordine.id,motivo,altro)) }}>Rifiuta ordine</button>
      </div>
    </Pannello>
  </>
}
const VERBO: Record<string,string> = { 'In preparazione': 'Inizia a preparare',Pronto: 'Segna pronto',Partito: 'Segna partito',Consegnato: 'Segna consegnato',Ritirato: 'Segna ritirato' }
/** Ordine da casa: `daAccettare` mostra accetta/rifiuta, altrimenti il prossimo passo della cucina. */
export function CardOrdineCasa({ ordine: o,ora,inCorso,esegui,daAccettare,comande }: { ordine: OrdineCasaClient; ora: string; inCorso: boolean; esegui: Esegui; daAccettare: boolean; comande?: StatoReparto[] }) {
  const lunga = daAccettare && attesaLunga(o.creatoIl,new Date(ora))
  const avanza = azioneAvanzaCasa(o.tipo,o.stato)
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(o.creatoIl).getTime()) / 60000))
  const titolo = `${o.tipo === 'domicilio' ? 'Domicilio' : 'Asporto'} ${oraRoma(new Date(o.fascia))} · n. ${o.numero}`
  return <article className={`b-comanda${daAccettare ? ' b-comanda--accettare' : ''}${lunga ? ' b-comanda--ritardo' : ''}${!daAccettare && o.stato === 'in_preparazione' ? ' b-comanda--preparazione' : ''}${['pronto','in_consegna'].includes(o.stato) ? ' b-comanda--pronto' : ''}`}>
    <div className="b-comanda__testa">
      <h3 className="b-comanda__titolo"><span className="b-comanda__tipo">{o.tipo === 'domicilio' ? 'Domicilio' : 'Asporto'}</span> <span className="b-comanda__nome b-num">{oraRoma(new Date(o.fascia))}</span> <span className="b-num b-comanda__numero">· n. {o.numero}</span></h3>
      {daAccettare && <span className="b-num b-comanda__timer" aria-label={`${minuti} min`}>{minuti}′</span>}
    </div>
    {etichettaOrigine(o.origine) && <span className="b-etichetta">{etichettaOrigine(o.origine)}</span>}
    {!daAccettare && <ChipComande comande={comande} />}
    {lunga && <p className="b-avviso b-avviso--ritardo"><strong>In attesa da più di 10 minuti</strong></p>}
    <p className="b-comanda__meta">{o.clienteNome} · {o.clienteTelefono && <a href={`tel:${o.clienteTelefono}`}>{o.clienteTelefono}</a>} · <span className="b-num">{formatEuro(o.totaleCent)}</span> · {o.pagamento === 'carta' ? 'Carta' : `Contanti${o.contantiDaCent ? ` (paga con ${formatEuro(o.contantiDaCent)})` : ''}`}</p>
    {o.tipo === 'domicilio' && <p className="b-comanda__meta">{o.indirizzo} · {o.zonaNome}{o.noteConsegna && ` · ${o.noteConsegna}`}{o.consegnaCent > 0 && ` · consegna ${formatEuro(o.consegnaCent)}`}</p>}
    <DettaglioRighe righe={o.righe} area="staff" perReparto />
    {daAccettare ? <div className="b-comanda__azioni">
      <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,0))}>Accetta</button>
      <div className="b-comanda__coppia">
        <button type="button" className="b-btn b-btn--secondario" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,15))}>Accetta +15’</button>
        <button type="button" className="b-btn b-btn--secondario" disabled={inCorso} onClick={() => esegui(() => accettaOrdineStaff(o.id,30))}>Accetta +30’</button>
      </div>
      <RifiutaOrdine ordine={o} inCorso={inCorso} esegui={esegui} />
    </div> : <div className="b-comanda__azioni">
      {avanza && <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => esegui(() => avanzaOrdineCasaStaff(o.id,o.stato))}>{VERBO[avanza] ?? avanza}</button>}
      <AltreAzioni titolo={`Altre azioni · ${titolo}`}>{chiudi => <>
        {o.righe.filter(r => !r.annullata).map(r => <ConfermaAzione key={r.id} inCorso={inCorso} domanda={`Annullare ${r.nome}?`} conferma={() => { chiudi(); esegui(() => annullaRigaStaff(r.id)) }}>Annulla {r.nome}</ConfermaAzione>)}
        <ConfermaAzione inCorso={inCorso} domanda={`Annullare l’ordine n. ${o.numero}? Il cliente riceverà un’email.`} conferma={() => { chiudi(); esegui(() => annullaOrdineCasaStaff(o.id)) }}>Annulla tutto l’ordine</ConfermaAzione>
      </>}</AltreAzioni>
    </div>}
  </article>
}
