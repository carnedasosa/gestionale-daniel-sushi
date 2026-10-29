'use client'
import { useActionState } from 'react'
import { formatEuro } from '@/domain/soldi'
import type { ImpostazioniCassa } from '@/cassa/impostazioni-repo'
import type { ImpostazioniFiscali } from '@/fiscale/scontrini-repo'
import { salvaCassa, salvaFiscale, type StatoModulo } from './azioni'
const INIZIALE: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const euro = (cent: number) => formatEuro(cent).replace(/\s*€$/,'')

export function ModuloCassa({ impostazioni: i }: { impostazioni: ImpostazioniCassa }) {
  const [stato,azione,inCorso] = useActionState(salvaCassa,INIZIALE)
  const v = stato.valori ?? { coperto: euro(i.copertoCent),stampaBanco: i.stampa.banco ? 'on' : '',stampaCucina: i.stampa.cucina ? 'on' : '',stampaSala: i.stampa.sala ? 'on' : '' }
  return <form key={stato.invii} action={azione} className="b-card b-admin-modulo b-impostazioni">
    <label className="b-campo">Coperto a persona (€, 0 = non si addebita)<input name="coperto" inputMode="decimal" defaultValue={v.coperto} /></label>
    <fieldset className="b-admin-sezione"><legend className="b-occhiello">Comande su carta</legend>
      <p className="b-secondario b-piccolo">Il reparto spuntato riceve le comande dalla sua stampante invece che dallo schermo. Serve il ponte di stampa acceso alla cassa.</p>
      <label className="b-scelta"><input type="checkbox" name="stampaBanco" defaultChecked={v.stampaBanco === 'on'} />Banco sushi</label>
      <label className="b-scelta"><input type="checkbox" name="stampaCucina" defaultChecked={v.stampaCucina === 'on'} />Cucina</label>
      <label className="b-scelta"><input type="checkbox" name="stampaSala" defaultChecked={v.stampaSala === 'on'} />Bevande (alla stampante della cassa)</label>
    </fieldset>
    {stato.errore && <p role="alert" className="b-errore">{stato.errore}</p>}{stato.salvato && <p role="status" className="b-secondario">Salvato.</p>}
    <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva impostazioni'}</button>
  </form>
}

export function ModuloFiscale({ impostazioni: i,categorie }: { impostazioni: ImpostazioniFiscali; categorie: { id: string; nome: string; repartoFiscale: number }[] }) {
  const [stato,azione,inCorso] = useActionState(salvaFiscale,INIZIALE)
  const v = stato.valori ?? { repartoCoperto: String(i.repartoCoperto),repartoConsegna: String(i.repartoConsegna),indiceCarta: String(i.indiceCarta),automatico: i.automatico ? 'on' : '',
    ...Object.fromEntries(categorie.map(c => [`reparto:${c.id}`,String(c.repartoFiscale)])) }
  const numero = (nome: string, etichetta: string) => <label key={nome} className="b-campo b-campo--reparto">{etichetta}<input name={nome} type="number" min={1} max={99} required defaultValue={v[nome]} className="b-num" /></label>
  return <form key={stato.invii} action={azione} className="b-card b-admin-modulo">
    <label className="b-scelta"><input type="checkbox" name="automatico" defaultChecked={v.automatico === 'on'} />Emetti lo scontrino a ogni incasso (si può togliere di volta in volta)</label>
    <fieldset className="b-admin-sezione"><legend className="b-occhiello">Reparti fiscali</legend>
      <p className="b-secondario b-piccolo">Il numero del reparto programmato sul registratore: l’aliquota IVA la applica il registratore. Di solito tutto al reparto della somministrazione (10%); chiedi al commercialista per bevande e asporto.</p>
      <div className="b-reparti-fiscali">
        {numero('repartoCoperto','Coperto')}{numero('repartoConsegna','Consegna a domicilio')}
        {categorie.map(c => numero(`reparto:${c.id}`,c.nome))}
      </div>
    </fieldset>
    {numero('indiceCarta','Indice del pagamento elettronico sul registratore')}
    {stato.errore && <p role="alert" className="b-errore">{stato.errore}</p>}{stato.salvato && <p role="status" className="b-secondario">Salvato.</p>}
    <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva il registratore'}</button>
  </form>
}
