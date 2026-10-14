'use client'

import { useActionState } from 'react'
import type { PokeConfig } from '@/menu/importa'
import { formatEuro } from '@/domain/soldi'
import { salvaPoke, type StatoPoke } from './azioni'
const INIZIALE: StatoPoke = { salvato: false, errore: null, valori: null, invii: 0 }
export function ModuloPoke({ config }: { config: PokeConfig }) {
  const [stato,azione,inCorso] = useActionState(salvaPoke,INIZIALE)
  const prezzo = (cent: number | null) => cent === null ? '' : formatEuro(cent).replace(/\s*€$/,'')
  return <form key={stato.invii} action={azione} className="b-admin-modulo" id="regole">
    <section className="b-card b-admin-due">
      <label className="b-campo b-campo--prezzo">Prezzo base (€)<input name="base" inputMode="decimal" required className="b-num" defaultValue={stato.valori?.base ?? prezzo(config.prezzoBaseCent)} /></label>
      <label className="b-campo b-campo--prezzo">Ogni ingrediente in più (€)<input name="extra" inputMode="decimal" required className="b-num" defaultValue={stato.valori?.extra ?? prezzo(config.prezzoExtraCent)} /></label>
    </section>
    <section className="b-card" aria-labelledby="titolo-gruppi">
      <h2 id="titolo-gruppi" className="b-titolo-3">Quanti ingredienti per gruppo</h2>
      <div className="b-tabella-scorre"><table className="b-tabella b-tabella-gruppi">
        <thead><tr><th>Gruppo</th><th>Minimo</th><th>Massimo</th><th>Inclusi</th></tr></thead>
        <tbody>{config.gruppi.map((g,i) => <tr key={g.nome}>
          <td><strong>{g.nome}</strong><br /><span className="b-secondario b-piccolo">{g.voci.length} ingredienti · {g.voci.slice(0,3).join(', ')}{g.voci.length > 3 ? '…' : ''}</span></td>
          {(['min','max','inclusi'] as const).map(campo => <td key={campo}><input className="b-input b-num" type="number" min={0} max={g.voci.length} name={`${campo}_${i}`} required aria-label={`${g.nome}: ${{ min: 'minimo',max: 'massimo',inclusi: 'inclusi' }[campo]}`} defaultValue={stato.valori?.gruppi[i]?.[campo] ?? g[campo]} /></td>)}
        </tr>)}</tbody>
      </table></div>
      <p className="b-secondario b-piccolo">«Inclusi»: quanti ingredienti del gruppo sono compresi nel prezzo base. Quelli oltre si pagano a parte.</p>
    </section>
    {stato.errore && <p role="alert" className="b-avviso b-avviso--ritardo">{stato.errore}</p>}
    <div className="b-barra-salva"><p className="b-barra-salva__testo b-secondario" role="status">{stato.salvato ? 'Salvato.' : ''}</p>
      <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva le regole'}</button></div>
  </form>
}
