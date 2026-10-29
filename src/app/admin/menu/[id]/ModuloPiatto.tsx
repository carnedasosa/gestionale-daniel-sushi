'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ALLERGENI, type CodiceAllergene } from '@/domain/allergeni'
import { testoAllergeni } from '@/menu/testo-allergeni'
import type { InputPiatto } from '@/menu/valida-piatto'
import { ETICHETTA_FORMATO, ETICHETTA_TIPOLOGIA, FORMATI_VINO, TIPOLOGIE_VINO, type TipoCategoria } from '@/domain/vini'
import { creaNuovoPiatto, salvaPiatto, type StatoModulo } from '../azioni'

const INIZIALE: StatoModulo = { salvato: false, errori: {}, erroreGenerale: null, valori: null, invii: 0 }

export interface CategoriaScelta { id: string; nome: string; tipo: TipoCategoria }
/**
 * Modulo del piatto. Con `id` modifica quel piatto; senza, ne crea uno nuovo e chiede categoria e numero (`nuovo`).
 * Le categorie di tipo «vini» aggiungono i campi del vino.
 */
export function ModuloPiatto({ id, valori, vino = false, nuovo }: { id: string | null; valori: InputPiatto; vino?: boolean; nuovo?: { categorie: CategoriaScelta[]; categoriaId: string; numero: string } }) {
  const [stato, azione, inCorso] = useActionState(id ? salvaPiatto.bind(null, id) : creaNuovoPiatto, INIZIALE)
  const e = stato.errori
  const v = stato.valori ?? valori
  const [categoriaId, setCategoriaId] = useState(nuovo?.categoriaId ?? '')
  const conVino = nuovo ? nuovo.categorie.find((c) => c.id === categoriaId)?.tipo === 'vini' : vino
  // Solo per l'anteprima del testo che leggerà il cliente: i valori inviati restano quelli del modulo.
  const [scelti, setScelti] = useState<string[]>(v.allergeni)
  const anteprima = testoAllergeni({ allergeni: scelti as CodiceAllergene[], allergeniConfermati: true })
  return (
    <form key={stato.invii} action={azione} className="b-admin-modulo">
      <div className="b-admin-due">
        <section className="b-card" aria-labelledby="come-appare">
          <h2 id="come-appare" className="b-titolo-3">Come appare nel menù</h2>
          {nuovo && <>
            <label className="b-campo">Categoria<select name="categoriaId" value={categoriaId} onChange={(ev) => setCategoriaId(ev.target.value)} required>
              <option value="" disabled>Scegli la categoria</option>
              {nuovo.categorie.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label className="b-campo">Numero nel menù (facoltativo)<input name="numero" defaultValue={stato.valori ? undefined : nuovo.numero} inputMode="numeric" pattern="[0-9]*" maxLength={4} className="b-num" /></label>
          </>}
          <label className="b-campo">Nome<input name="nome" defaultValue={v.nome} required maxLength={120} aria-invalid={!!e.nome} /></label>
          {e.nome && <p className="b-errore">{e.nome}</p>}
          <label className="b-campo">Descrizione<textarea name="descrizione" defaultValue={v.descrizione} rows={3} maxLength={500} /></label>
          {e.descrizione && <p className="b-errore">{e.descrizione}</p>}
          <label className="b-campo b-campo--prezzo">Prezzo (€)<input name="prezzo" defaultValue={v.prezzo} inputMode="decimal" required aria-invalid={!!e.prezzo} className="b-num" /></label>
          {e.prezzo && <p className="b-errore">{e.prezzo}</p>}
          {conVino && <fieldset className="b-admin-sezione">
            <legend className="b-occhiello">Il vino</legend>
            <input type="hidden" name="conVino" value="on" />
            <label className="b-campo">Tipologia<select name="vinoTipologia" defaultValue={v.vinoTipologia ?? ''} aria-invalid={!!e.vinoTipologia}>
              <option value="">Scegli</option>{TIPOLOGIE_VINO.map((t) => <option key={t} value={t}>{ETICHETTA_TIPOLOGIA[t]}</option>)}</select></label>
            {e.vinoTipologia && <p className="b-errore">{e.vinoTipologia}</p>}
            <label className="b-campo">Formato<select name="vinoFormato" defaultValue={v.vinoFormato ?? 'bottiglia'} aria-invalid={!!e.vinoFormato}>
              {FORMATI_VINO.map((f) => <option key={f} value={f}>{ETICHETTA_FORMATO[f]}</option>)}</select></label>
            {e.vinoFormato && <p className="b-errore">{e.vinoFormato}</p>}
            <label className="b-campo">Cantina<input name="vinoCantina" defaultValue={v.vinoCantina ?? ''} maxLength={80} /></label>
            {e.vinoCantina && <p className="b-errore">{e.vinoCantina}</p>}
            <label className="b-campo">Denominazione (es. Falanghina del Sannio DOC)<input name="vinoDenominazione" defaultValue={v.vinoDenominazione ?? ''} maxLength={120} /></label>
            {e.vinoDenominazione && <p className="b-errore">{e.vinoDenominazione}</p>}
            <label className="b-campo">Annata<input name="vinoAnnata" defaultValue={v.vinoAnnata ?? ''} inputMode="numeric" maxLength={4} className="b-num" aria-invalid={!!e.vinoAnnata} /></label>
            {e.vinoAnnata && <p className="b-errore">{e.vinoAnnata}</p>}
          </fieldset>}
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
        <button className="b-btn b-btn--principale" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : id ? 'Salva il piatto' : 'Aggiungi al menù'}</button>
      </div>
    </form>
  )
}
