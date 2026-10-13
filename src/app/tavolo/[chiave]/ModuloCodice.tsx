'use client'
import { startTransition, useActionState, useEffect, useState } from 'react'
import { entraAlTavolo, inizializzaDispositivo, pulisciCookieTavolo } from './azioni'
export function ModuloCodice({ chiave,pulisci = false,chiuso = false,tavoloAperto = false }: { chiave: string; pulisci?: boolean; chiuso?: boolean; tavoloAperto?: boolean }) {
  const [eraChiuso] = useState(chiuso)
  const [stato,azione,inCorso] = useActionState(entraAlTavolo.bind(null,chiave),{ errore: null })
  useEffect(() => { startTransition(() => { void inizializzaDispositivo().catch(() => { /* Il submit riprova a creare il cookie. */ }) }) },[])
  useEffect(() => { if (pulisci) startTransition(() => { void pulisciCookieTavolo(chiave).catch(() => {}) }) },[pulisci,chiave])
  return <form action={azione} className="b-codice">
    {(chiuso || eraChiuso) && !tavoloAperto && <p role="status" className="b-avviso b-avviso--pronto">Il tavolo è chiuso, grazie per essere stati da noi!</p>}
    <p className="b-codice__istruzione">Scrivi il codice di 4 cifre che ti ha dato il cameriere.</p>
    <label className="b-campo">Codice del tavolo<input className="b-codice__input" name="codice" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="\d{4}" required aria-invalid={!!stato.errore} /></label>
    {stato.errore && <p role="alert" className="b-avviso b-avviso--ritardo">{stato.errore}</p>}
    <button className="b-btn b-btn--principale b-btn--barra" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Verifica in corso…' : 'Entra al tavolo'}</button>
    <p className="b-avviso b-piccolo b-secondario">Tutti i telefoni dello stesso tavolo vedono gli stessi ordini. Il codice cambia a ogni apertura del tavolo.</p>
  </form>
}
