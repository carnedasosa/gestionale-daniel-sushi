'use client'
import { useState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import { validaPoke, type SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
export function ComponiPoke({ config,aggiungi }: { config: PokeConfig; aggiungi: (scelte: SceltePoke) => void }) {
  const [scelte,setScelte] = useState<SceltePoke>({})
  const esito = validaPoke(config,scelte)
  const extra = config.gruppi.reduce((s,g) => s + Math.max(0,(scelte[g.nome]?.length ?? 0) - g.inclusi),0)
  return <div className="tavolo-poke">
    <p>Gli allergeni della poke dipendono dagli ingredienti: chiedi al personale prima di ordinare.</p>
    {config.gruppi.map(g => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend><p>{scelte[g.nome]?.length ?? 0} di {g.max} ({g.inclusi} incluse) · minimo {g.min}</p>
      {g.voci.map(v => <label className="tavolo-scelta" key={v}><input type={g.max === 1 ? 'radio' : 'checkbox'} name={`poke-${g.nome}`} checked={scelte[g.nome]?.includes(v) ?? false}
        onChange={e => setScelte(s => ({ ...s,[g.nome]: g.max === 1 ? [v] : e.target.checked ? [...(s[g.nome] ?? []),v] : (s[g.nome] ?? []).filter(x => x !== v) }))} />{v}</label>)}
      {g.max === 1 && g.min === 0 && <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setScelte(s => ({ ...s,[g.nome]: [] }))}>Nessuno</button>}
    </fieldset>)}
    <p aria-live="polite">Prezzo stimato: <strong>{formatEuro((config.prezzoBaseCent ?? 0) + extra * (config.prezzoExtraCent ?? 0))}</strong></p>
    {!esito.ok && <p role="status">{esito.errore}</p>}
    <button type="button" className="ds-btn ds-btn--secondary" disabled={!esito.ok} onClick={() => { if (esito.ok) aggiungi(esito.scelte) }}>Aggiungi al carrello</button>
  </div>
}
