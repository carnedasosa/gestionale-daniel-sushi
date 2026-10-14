'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ALLERGENI, type CodiceAllergene } from '@/domain/allergeni'
import { testoAllergeni } from '@/menu/testo-allergeni'
import type { InputPiatto } from '@/menu/valida-piatto'
import { salvaPiatto, type StatoModulo } from '../azioni'

const INIZIALE: StatoModulo = { salvato: false, errori: {}, erroreGenerale: null, valori: null, invii: 0 }

export function ModuloPiatto({ id, valori }: { id: string; valori: InputPiatto }) {
  const [stato, azione, inCorso] = useActionState(salvaPiatto.bind(null, id), INIZIALE)
  const e = stato.errori
  const v = stato.valori ?? valori
  // Solo per l'anteprima del testo che leggerà il cliente: i valori inviati restano quelli del modulo.
  const [scelti, setScelti] = useState<string[]>(v.allergeni)
  const anteprima = testoAllergeni({ allergeni: scelti as CodiceAllergene[], allergeniConfermati: true })
  return (
    <form key={stato.invii} action={azione} className="b-admin-modulo">
      <div className="b-admin-due">
        <section className="b-card" aria-labelledby="come-appare">
          <h2 id="come-appare" className="b-titolo-3">Come appare nel menù</h2>
          <label className="b-campo">Nome<input name="nome" defaultValue={v.nome} required maxLength={120} aria-invalid={!!e.nome} /></label>
          {e.nome && <p className="b-errore">{e.nome}</p>}
          <label className="b-campo">Descrizione<textarea name="descrizione" defaultValue={v.descrizione} rows={3} maxLength={500} /></label>
          {e.descrizione && <p className="b-errore">{e.descrizione}</p>}
          <label className="b-campo b-campo--prezzo">Prezzo (€)<input name="prezzo" defaultValue={v.prezzo} inputMode="decimal" required aria-invalid={!!e.prezzo} className="b-num" /></label>
          {e.prezzo && <p className="b-errore">{e.prezzo}</p>}
          <fieldset className="b-admin-sezione">
            <legend className="b-occhiello">Etichette</legend>
            <div className="b-pillole-scelta">
              <label className="b-scelta"><input type="checkbox" name="dellaCasa" defaultChecked={v.dellaCasa} />Della casa</label>
              <label className="b-scelta"><input type="checkbox" name="piccante" defaultChecked={v.piccante} />Piccante</label>
              <label className="b-scelta"><input type="checkbox" name="vegetariano" defaultChecked={v.vegetariano} />Vegetariano</label>
            </div>
          </fieldset>
        </section>
        <fieldset className="b-card b-admin-largo">
          <legend className="b-titolo-3 b-checkout__titolo">Allergeni</legend>
          <p className="b-secondario b-piccolo">I 14 allergeni del Reg. UE 1169/2011. Spunta quelli presenti nel piatto.</p>
          <div className="b-griglia-allergeni">
            {ALLERGENI.map((a) => (
              <label key={a.codice} className="b-scelta">
                <input type="checkbox" name="allergeni" value={a.codice} defaultChecked={v.allergeni.includes(a.codice)}
                  onChange={(ev) => setScelti((s) => ev.target.checked ? [...s, a.codice] : s.filter((x) => x !== a.codice))} />{a.etichetta}
              </label>
            ))}
          </div>
          {e.allergeni && <p className="b-errore">{e.allergeni}</p>}
          <label className="b-conferma-allergeni">
            <input type="checkbox" name="allergeniConfermati" defaultChecked={v.allergeniConfermati} />
            <span><strong>Ho verificato gli allergeni di questo piatto.</strong> Il cliente leggerà: «{anteprima}».</span>
          </label>
        </fieldset>
      </div>
      {stato.erroreGenerale && <p role="alert" className="b-avviso b-avviso--ritardo">{stato.erroreGenerale}</p>}
      <div className="b-barra-salva">
        <p className="b-barra-salva__testo b-secondario" role="status">{stato.salvato ? 'Salvato.' : ''}</p>
        <Link className="b-btn b-btn--secondario" href="/admin/menu">Annulla</Link>
        <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva il piatto'}</button>
      </div>
    </form>
  )
}
