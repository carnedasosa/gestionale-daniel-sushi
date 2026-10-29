'use client'
import { useActionState } from 'react'
import { formatEuro } from '@/domain/soldi'
import type { ImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { salvaCassa, type StatoModulo } from './azioni'
const INIZIALE: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const euro = (cent: number) => formatEuro(cent).replace(/\s*€$/,'')

export function ModuloCassa({ impostazioni: i }: { impostazioni: ImpostazioniCassa }) {
  const [stato,azione,inCorso] = useActionState(salvaCassa,INIZIALE)
  const v = stato.valori ?? { coperto: euro(i.copertoCent) }
  return <form key={stato.invii} action={azione} className="b-card b-admin-modulo b-impostazioni">
    <label className="b-campo">Coperto a persona (€, 0 = non si addebita)<input name="coperto" inputMode="decimal" defaultValue={v.coperto} /></label>
    {stato.errore && <p role="alert" className="b-errore">{stato.errore}</p>}{stato.salvato && <p role="status" className="b-secondario">Salvato.</p>}
    <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva impostazioni'}</button>
  </form>
}
