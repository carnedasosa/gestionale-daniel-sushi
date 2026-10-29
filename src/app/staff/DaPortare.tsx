'use client'
import type { VoceDaPortareClient, StatoReparto } from '@/comande/comande-repo'
import { ETICHETTA_REPARTO } from '@/domain/reparti'
import { ETICHETTA_STATO_COMANDA } from '@/domain/comande'
import { portaComandaStaff } from './azioni-comande'
import type { AzioniDi } from './useEsegui'

// Comande su carta: il gestionale non sa quando sono pronte, quindi restano «in preparazione» finché la sala le porta.
const cosa = (v: VoceDaPortareClient) => v.reparto === 'sala' ? 'Bevande' : v.stato === 'pronta' ? `${ETICHETTA_REPARTO[v.reparto]}, pronto` : `${ETICHETTA_REPARTO[v.reparto]}, su carta`
const tono = (v: VoceDaPortareClient) => v.reparto === 'sala' ? 'b-etichetta--preparare' : v.stato === 'pronta' ? 'b-etichetta--pronto' : 'b-etichetta--preparazione'
/**
 * Striscia «Da portare al tavolo» di cassa e sala: bevande da servire, piatti pronti di banco e cucina e comande stampate.
 * Elenco e non card: le card con il titolo dell'ordine restano una per ordine.
 */
export function DaPortare({ voci,nuove,azioniDi }: { voci: VoceDaPortareClient[]; nuove: string[]; azioniDi: AzioniDi }) {
  if (!voci.length) return null
  return <section aria-labelledby="da-portare" className="b-portare">
    <h2 id="da-portare" className="b-colonna__titolo"><span className="b-punto b-punto--pronto" aria-hidden="true" />Da portare al tavolo <span className="b-num b-secondario">{voci.length}</span></h2>
    <ul className="b-portare__voci">{voci.map(v => { const { inCorso,esegui } = azioniDi(`comanda:${v.id}`)
    return <li key={v.id} className={`b-portare__voce${nuove.includes(v.id) ? ' b-portare__voce--nuova' : ''}`}>
      <div className="b-portare__testo">
        <p className="b-portare__dove"><strong>{v.tavoloNome}</strong> <span className="b-num b-secondario">· n. {v.numeroGiorno}</span> · <span className={`b-etichetta ${tono(v)}`}>{cosa(v)}</span></p>
        <p className="b-portare__righe">{v.righe.map(r => `${r.quantita}× ${r.nome}`).join(', ')}</p>
      </div>
      <button type="button" className="b-btn b-btn--principale b-btn--staff" disabled={inCorso} aria-label={`Portate · ${v.tavoloNome} n. ${v.numeroGiorno} · ${cosa(v)}`} onClick={() => esegui(() => portaComandaStaff(v.id))}>Portate</button>
    </li> })}</ul>
  </section>
}

/** Un chip per reparto sulle card della cassa, solo se l'ordine ne tocca più di uno. */
export function ChipComande({ comande }: { comande?: StatoReparto[] }) {
  const attive = (comande ?? []).filter(c => c.stato !== 'annullata')
  if (attive.length < 2) return null
  return <ul className="b-comanda__reparti" aria-label="Reparti">{attive.map(c => <li key={c.reparto}
    className={`b-etichetta${c.stato === 'pronta' ? ' b-etichetta--pronto' : c.stato === 'in_preparazione' ? ' b-etichetta--preparazione' : ''}`}>
    {ETICHETTA_REPARTO[c.reparto]}: {c.reparto === 'sala' ? (c.stato === 'pronta' ? 'portate' : 'da portare') : ETICHETTA_STATO_COMANDA[c.stato]}
  </li>)}</ul>
}
