'use client'
import { useActionState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import type { AllergeniPoke } from '@/domain/allergeni-poke'
import { ALLERGENI } from '@/domain/allergeni'
import { salvaAllergeniPokeAdmin, type StatoAllergeniPoke } from './azioni'
const INIZIALE: StatoAllergeniPoke = { salvato: false,errore: null,invii: 0 }
export function ModuloAllergeniPoke({ config,allergeni }: { config: PokeConfig; allergeni: AllergeniPoke }) {
  const [stato,azione,inCorso] = useActionState(salvaAllergeniPokeAdmin,INIZIALE)
  return <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
    {config.gruppi.map((g,gi) => <fieldset key={g.nome}>
      <legend className="heading-sm">{g.nome}</legend>
      {g.voci.map((v,vi) => <details key={v}>
        <summary>{v}{allergeni.voci[g.nome]?.[v]?.length ? ` · ${allergeni.voci[g.nome][v].length} allergeni` : ' · nessun allergene'}</summary>
        <div className="admin-griglia-allergeni">{ALLERGENI.map(a => <label key={a.codice}>
          <input type="checkbox" name={`allergeni_${gi}_${vi}`} value={a.codice} defaultChecked={allergeni.voci[g.nome]?.[v]?.includes(a.codice)} /> {a.etichetta}
        </label>)}</div>
      </details>)}
    </fieldset>)}
    <label className="admin-tavolo-check"><input type="checkbox" name="confermati" defaultChecked={allergeni.confermati} /> <strong>Ho verificato gli allergeni di tutti gli ingredienti</strong></label>
    {stato.errore && <p role="alert">{stato.errore}</p>}
    {stato.salvato && <p role="status">Salvato.</p>}
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva allergeni'}</button>
  </form>
}
