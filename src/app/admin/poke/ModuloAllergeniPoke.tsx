'use client'
import { useActionState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import type { AllergeniPoke } from '@/domain/allergeni-poke'
import { ALLERGENI } from '@/domain/allergeni'
import { salvaAllergeniPokeAdmin, type StatoAllergeniPoke } from './azioni'
const INIZIALE: StatoAllergeniPoke = { salvato: false,errore: null,invii: 0 }
export function ModuloAllergeniPoke({ config,allergeni }: { config: PokeConfig; allergeni: AllergeniPoke }) {
  const [stato,azione,inCorso] = useActionState(salvaAllergeniPokeAdmin,INIZIALE)
  return <form key={stato.invii} action={azione} className="b-admin-modulo">
    {config.gruppi.map((g,gi) => <fieldset key={g.nome} className="b-admin-sezione">
      <legend className="b-titolo-3">{g.nome}</legend>
      <div className="b-ingredienti">{g.voci.map((v,vi) => { const n = allergeni.voci[g.nome]?.[v]?.length ?? 0
        return <details key={v} className="b-ingrediente">
          <summary>{v}<span>{n ? `${n} allergeni` : 'nessun allergene'}</span></summary>
          <div className="b-griglia-allergeni">{ALLERGENI.map(a => <label key={a.codice} className="b-scelta">
            <input type="checkbox" name={`allergeni_${gi}_${vi}`} value={a.codice} defaultChecked={allergeni.voci[g.nome]?.[v]?.includes(a.codice)} />{a.etichetta}
          </label>)}</div>
        </details> })}</div>
    </fieldset>)}
    <label className={`b-conferma-allergeni${allergeni.confermati ? ' b-conferma-allergeni--ok' : ''}`}><input type="checkbox" name="confermati" defaultChecked={allergeni.confermati} /><strong>Ho verificato gli allergeni di tutti gli ingredienti</strong></label>
    {stato.errore && <p role="alert" className="b-avviso b-avviso--ritardo">{stato.errore}</p>}
    <div className="b-barra-salva"><p className="b-barra-salva__testo b-secondario" role="status">{stato.salvato ? 'Salvato.' : ''}</p>
      <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva allergeni'}</button></div>
  </form>
}
