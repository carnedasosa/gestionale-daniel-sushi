'use client'
import type { ComandaClient } from '@/comande/comande-repo'
import { azioneAvanzaComanda } from '@/domain/comande'
import { etichettaOrigine } from '@/domain/origine-ordine'
import { oraRoma } from '@/domain/ora-roma'
import { ETICHETTA_REPARTO, type Reparto } from '@/domain/reparti'
import { DettaglioRighe } from '@/componenti/DettaglioRighe'
import { avanzaComandaStaff } from './azioni-comande'
import type { Esegui } from './useEsegui'

const DOVE: Record<Reparto,string> = { banco: 'al banco',cucina: 'in cucina',sala: 'da portare' }
const piatti = (n: number) => `${n} ${n === 1 ? 'piatto' : 'piatti'}`
/**
 * Comanda di un reparto (banco o cucina). Titolo uguale alle card della cassa («Tavolo 3 · n. 12»,
 * «Asporto 19:30 · n. 9») e bottoni con gli stessi nomi: schermi e prove la riconoscono allo stesso modo.
 * Niente annullamenti: restano alla cassa.
 */
export function CardComanda({ comanda: c,ora,nuova,inCorso,leggi,esegui }: { comanda: ComandaClient; ora: string; nuova: boolean; inCorso: boolean; leggi: () => void; esegui: Esegui }) {
  const minuti = Math.max(0,Math.floor((new Date(ora).getTime() - new Date(c.creataIl).getTime()) / 60000))
  const azione = azioneAvanzaComanda(c.stato,c.reparto)
  const origine = etichettaOrigine(c.origine)
  const altri = c.altreRighe.filter(a => a.reparto !== 'sala')
  return <article className={`b-comanda${nuova ? ' b-comanda--nuovo' : ''}${c.stato === 'in_preparazione' ? ' b-comanda--preparazione' : ''}${c.stato === 'pronta' ? ' b-comanda--pronto' : ''}`} onClick={leggi}>
    <div className="b-comanda__testa">
      {c.tipo === 'tavolo'
        ? <h3 className="b-comanda__titolo"><span className="b-comanda__nome">{c.tavoloNome}</span> <span className="b-num b-comanda__numero">· n. {c.numero}</span></h3>
        : <h3 className="b-comanda__titolo"><span className="b-comanda__tipo">{c.tipo === 'domicilio' ? 'Domicilio' : 'Asporto'}</span> <span className="b-comanda__nome b-num">{oraRoma(new Date(c.fascia!))}</span> <span className="b-num b-comanda__numero">· n. {c.numero}</span></h3>}
      <span className="b-num b-comanda__timer" aria-label={`${minuti} min`}>{minuti}′</span>
    </div>
    {(nuova || origine) && <div className="b-comanda__etichette">{nuova && <span className="b-etichetta b-etichetta--accettare">Nuova comanda</span>}{origine && <span className="b-etichetta">{origine}</span>}</div>}
    {c.tavoloChiuso && <p className="b-nota">Tavolo chiuso</p>}
    <DettaglioRighe righe={c.righe} area="staff" />
    {altri.length > 0 && <p className="b-secondario b-comanda__altri">{altri.map(a => `+ ${piatti(a.n)} ${DOVE[a.reparto]}`).join(' · ')}</p>}
    <div className="b-comanda__azioni">
      {azione ? <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} onClick={() => { leggi(); esegui(() => avanzaComandaStaff(c.id,c.stato)) }}>{azione}</button>
        : <p className="b-secondario">Pronta{altri.length ? `: l’ordine aspetta ${altri.map(a => ETICHETTA_REPARTO[a.reparto].toLowerCase()).join(' e ')}` : ''}.</p>}
    </div>
  </article>
}
