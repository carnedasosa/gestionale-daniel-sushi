'use client'

import { useActionState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import { formatEuro } from '@/domain/soldi'
import { salvaPoke, type StatoPoke } from './azioni'
const INIZIALE: StatoPoke = { salvato: false, errore: null, valori: null, invii: 0 }
export function ModuloPoke({ config }: { config: PokeConfig }) {
  const [stato,azione,inCorso] = useActionState(salvaPoke,INIZIALE)
  const prezzo = (cent: number | null) => cent === null ? '' : formatEuro(cent).replace(/\s*€$/,'')
  return <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
    <label className="campo">Prezzo base (€)<input name="base" inputMode="decimal" required defaultValue={stato.valori?.base ?? prezzo(config.prezzoBaseCent)} /></label>
    <label className="campo">Prezzo di ogni ingrediente extra (€)<input name="extra" inputMode="decimal" required defaultValue={stato.valori?.extra ?? prezzo(config.prezzoExtraCent)} /></label>
    {config.gruppi.map((g,i) => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend><p>{g.voci.join(' · ')}</p>
      <div className="admin-poke-regole">{(['min','max','inclusi'] as const).map(campo => <label className="campo" key={campo}>
        {{ min: 'Minimo', max: 'Massimo', inclusi: 'Inclusi' }[campo]}
        <input type="number" min={0} max={g.voci.length} name={`${campo}_${i}`} required defaultValue={stato.valori?.gruppi[i]?.[campo] ?? g[campo]} />
      </label>)}</div>
    </fieldset>)}
    {stato.errore && <p role="alert">{stato.errore}</p>}
    {stato.salvato && <p role="status">Salvato.</p>}
    <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva'}</button>
  </form>
}
