'use client'

import { useActionState } from 'react'
import { entra, type StatoAccesso } from './azioni'

export function ModuloAccesso({ next, erroreIniziale }: { next: string; erroreIniziale: string | null }) {
  const [stato, azione, inCorso] = useActionState<StatoAccesso, FormData>(entra, { errore: erroreIniziale })
  return (
    <form action={azione} className="b-accesso__modulo">
      <input type="hidden" name="next" value={next} />
      <label className="b-campo">
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="b-campo">
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {stato.errore && <p role="alert" className="b-avviso b-avviso--ritardo">{stato.errore}</p>}
      <button className="b-btn b-btn--principale b-btn--barra" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Accesso in corso…' : 'Entra'}</button>
    </form>
  )
}
