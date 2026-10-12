'use client'

import { useActionState } from 'react'
import { ALLERGENI } from '@/domain/allergeni'
import type { InputPiatto } from '@/menu/valida-piatto'
import { salvaPiatto, type StatoModulo } from '../azioni'

const INIZIALE: StatoModulo = { salvato: false, errori: {}, erroreGenerale: null, valori: null, invii: 0 }

export function ModuloPiatto({ id, valori }: { id: string; valori: InputPiatto }) {
  const [stato, azione, inCorso] = useActionState(salvaPiatto.bind(null, id), INIZIALE)
  const e = stato.errori
  const v = stato.valori ?? valori
  return (
    <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
      <label className="campo">
        <span className="eyebrow">Nome</span>
        <input name="nome" defaultValue={v.nome} required maxLength={120} aria-invalid={!!e.nome} />
        {e.nome && <p className="admin-errore-campo">{e.nome}</p>}
      </label>
      <label className="campo">
        <span className="eyebrow">Descrizione</span>
        <textarea name="descrizione" defaultValue={v.descrizione} rows={3} maxLength={500} />
        {e.descrizione && <p className="admin-errore-campo">{e.descrizione}</p>}
      </label>
      <label className="campo">
        <span className="eyebrow">Prezzo (€)</span>
        <input name="prezzo" defaultValue={v.prezzo} inputMode="decimal" required aria-invalid={!!e.prezzo} />
        {e.prezzo && <p className="admin-errore-campo">{e.prezzo}</p>}
      </label>
      <fieldset className="campo">
        <legend className="eyebrow">Etichette</legend>
        <label><input type="checkbox" name="dellaCasa" defaultChecked={v.dellaCasa} /> Della casa</label>
        <label><input type="checkbox" name="piccante" defaultChecked={v.piccante} /> Piccante</label>
        <label><input type="checkbox" name="vegetariano" defaultChecked={v.vegetariano} /> Vegetariano</label>
      </fieldset>
      <fieldset className="campo">
        <legend className="eyebrow">Allergeni (Reg. UE 1169/2011)</legend>
        <div className="admin-griglia-allergeni">
          {ALLERGENI.map((a) => (
            <label key={a.codice}>
              <input type="checkbox" name="allergeni" value={a.codice} defaultChecked={v.allergeni.includes(a.codice)} /> {a.etichetta}
            </label>
          ))}
        </div>
        {e.allergeni && <p className="admin-errore-campo">{e.allergeni}</p>}
        <label>
          <input type="checkbox" name="allergeniConfermati" defaultChecked={v.allergeniConfermati} />{' '}
          <strong>Ho verificato gli allergeni di questo piatto</strong> (se nessuna casella è spuntata, il cliente leggerà «Nessuno dei 14 allergeni»)
        </label>
      </fieldset>
      {stato.erroreGenerale && <p role="alert" className="admin-errore-campo">{stato.erroreGenerale}</p>}
      {stato.salvato && <p role="status">Salvato.</p>}
      <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva'}</button>
    </form>
  )
}
