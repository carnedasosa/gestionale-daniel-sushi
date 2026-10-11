'use client'
import { startTransition, useActionState, useEffect } from 'react'
import { entraAlTavolo, inizializzaDispositivo } from './azioni'
export function ModuloCodice({ slug }: { slug: string }) {
  const [stato,azione,inCorso] = useActionState(entraAlTavolo.bind(null,slug),{ errore: null })
  useEffect(() => { startTransition(() => { void inizializzaDispositivo().catch(() => { /* Il submit riprova a creare il cookie. */ }) }) },[])
  return <form action={azione} className="tavolo-codice ds-card">
    <p>Inserisci il codice che ti ha dato il cameriere</p>
    <label className="campo">Codice del tavolo<input name="codice" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="\d{4}" required /></label>
    {stato.errore && <p role="alert">{stato.errore}</p>}
    <button className="ds-btn ds-btn--primary" disabled={inCorso}>{inCorso ? 'Verifica…' : 'Entra al tavolo'}</button>
  </form>
}
