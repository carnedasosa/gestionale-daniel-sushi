'use client'
import { startTransition, useActionState, useEffect, useState } from 'react'
import { entraAlTavolo, inizializzaDispositivo, pulisciCookieTavolo } from './azioni'
export function ModuloCodice({ chiave,pulisci = false,chiuso = false }: { chiave: string; pulisci?: boolean; chiuso?: boolean }) {
  const [eraChiuso] = useState(chiuso)
  const [stato,azione,inCorso] = useActionState(entraAlTavolo.bind(null,chiave),{ errore: null })
  useEffect(() => { startTransition(() => { void inizializzaDispositivo().catch(() => { /* Il submit riprova a creare il cookie. */ }) }) },[])
  useEffect(() => { if (pulisci) startTransition(() => { void pulisciCookieTavolo(chiave).catch(() => {}) }) },[pulisci,chiave])
  return <form action={azione} className="tavolo-codice ds-card">
    {(chiuso || eraChiuso) && <p role="status">Il tavolo è chiuso, grazie per essere stati da noi!</p>}
    <p>Inserisci il codice che ti ha dato il cameriere</p>
    <label className="campo">Codice del tavolo<input name="codice" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="\d{4}" required /></label>
    {stato.errore && <p role="alert">{stato.errore}</p>}
    <button className="ds-btn ds-btn--primary" disabled={inCorso}>{inCorso ? 'Verifica…' : 'Entra al tavolo'}</button>
  </form>
}
