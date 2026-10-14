'use client'
import { useState } from 'react'
import type { GruppoPoke, PokeConfig } from '@/menu/importa'
import { controllaGruppo, validaPoke, type SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
import { etichettaAllergene } from '@/domain/allergeni'
import { allergeniScelte, type AllergeniVoci } from '@/domain/allergeni-poke'

function istruzione(g: GruppoPoke, extraCent: number | null): string {
  if (g.max === 1) return g.min === 1 ? 'Scegline 1.' : 'Scegline al massimo 1, oppure nessuno.'
  const quante = g.min > 0 ? `da ${g.min} a ${g.max}` : `fino a ${g.max}`
  const incluse = g.inclusi < g.max ? ` ${g.inclusi === 1 ? 'La prima è inclusa' : `Le prime ${g.inclusi} sono incluse`}, le altre costano ${formatEuro(extraCent ?? 0)} ciascuna.` : ''
  return `Scegline ${quante}.${incluse}`
}

// Un gruppo per passo. Con `allergeni` (confermati dall'admin) mostra quelli della poke scelta; senza, rimanda al personale.
export function ComponiPoke({ config,aggiungi,allergeni }: { config: PokeConfig; aggiungi: (scelte: SceltePoke) => void; allergeni?: AllergeniVoci }) {
  const [scelte,setScelte] = useState<SceltePoke>({})
  const [passo,setPasso] = useState(0)
  const gruppi = config.gruppi, g = gruppi[passo], ultimo = passo === gruppi.length - 1
  const esito = validaPoke(config,scelte)
  const erroreGruppo = controllaGruppo(g,scelte[g.nome])
  const extra = gruppi.reduce((s,x) => s + Math.max(0,(scelte[x.nome]?.length ?? 0) - x.inclusi),0)
  const codici = allergeni ? allergeniScelte(allergeni,scelte) : []
  const scelti = scelte[g.nome] ?? []
  const cambia = (v: string,attiva: boolean) => setScelte(s => ({ ...s,[g.nome]: g.max === 1 ? (attiva ? [v] : []) : attiva ? [...(s[g.nome] ?? []),v] : (s[g.nome] ?? []).filter(x => x !== v) }))
  return <div className="b-poke">
    <div className="b-poke__passi" aria-hidden="true">{gruppi.map((x,i) => <span key={x.nome} className={i <= passo ? 'b-poke__segmento b-poke__segmento--fatto' : 'b-poke__segmento'} />)}</div>
    <p className="b-num b-secondario b-piccolo">Passo {passo + 1} di {gruppi.length}</p>
    {passo > 0 && <ul className="b-poke__fatti">{gruppi.slice(0,passo).map((x,i) => <li key={x.nome}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
      <span><strong>{x.nome}:</strong> {scelte[x.nome]?.length ? scelte[x.nome].join(', ') : 'nessuno'}</span>
      <button type="button" className="b-btn b-btn--discreto" onClick={() => setPasso(i)}>Cambia<span className="b-nascosto"> {x.nome}</span></button>
    </li>)}</ul>}
    <fieldset className="b-poke__gruppo">
      <legend className="b-titolo-2">{g.nome}</legend>
      <p className="b-secondario">{istruzione(g,config.prezzoExtraCent)}</p>
      <p className="b-num b-poke__contatore">{scelti.length} di {g.max} {g.max === 1 ? 'scelta' : 'scelte'}</p>
      <div className="b-scelte">{g.voci.map(v => <label className="b-scelta" key={v}>
        <input type={g.max === 1 ? 'radio' : 'checkbox'} name={`poke-${g.nome}`} checked={scelti.includes(v)} onChange={e => cambia(v,e.target.checked)} />{v}
      </label>)}</div>
      {g.max === 1 && g.min === 0 && <button type="button" className="b-btn b-btn--secondario" aria-pressed={!scelti.length} onClick={() => setScelte(s => ({ ...s,[g.nome]: [] }))}>Nessuno</button>}
    </fieldset>
    <div className="b-poke__allergeni" aria-live="polite">{allergeni
      ? <p>{codici.length ? `Allergeni della tua poke: ${codici.map(etichettaAllergene).join(', ')}` : 'Allergeni della tua poke: nessuno dei 14 allergeni'}</p>
      : <p>Gli allergeni della poke dipendono dagli ingredienti: chiedi al personale prima di ordinare.</p>}</div>
    {erroreGruppo ? <p role="status" className="b-errore">{erroreGruppo}</p> : ultimo && !esito.ok && <p role="status" className="b-errore">{esito.errore}</p>}
    <div className="b-poke__piede">
      <p className="b-poke__prezzo"><span className="b-secondario b-piccolo">Prezzo stimato</span><strong className="b-num">{formatEuro((config.prezzoBaseCent ?? 0) + extra * (config.prezzoExtraCent ?? 0))}</strong></p>
      {ultimo
        ? <button type="button" className="b-btn b-btn--principale b-btn--barra" disabled={!esito.ok} onClick={() => { if (esito.ok) aggiungi(esito.scelte) }}>Aggiungi al carrello</button>
        : <button type="button" className="b-btn b-btn--principale b-btn--barra" disabled={!!erroreGruppo} onClick={() => setPasso(passo + 1)}>Avanti: {gruppi[passo + 1].nome} →</button>}
    </div>
  </div>
}
