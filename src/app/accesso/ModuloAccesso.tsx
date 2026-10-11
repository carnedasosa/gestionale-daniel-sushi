'use client'

import { useActionState } from 'react'
import { entra, type StatoAccesso } from './azioni'

export function ModuloAccesso({ next, erroreIniziale }: { next: string; erroreIniziale: string | null }) {
  const [stato, azione, inCorso] = useActionState<StatoAccesso, FormData>(entra, { errore: erroreIniziale })
  return (
    <form action={azione} className="accesso ds-card">
      <input type="hidden" name="next" value={next} />
      <label className="campo">
        <span className="eyebrow">Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="campo">
        <span className="eyebrow">Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {stato.errore && <p role="alert" className="accesso__errore">{stato.errore}</p>}
      <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Accesso in corso…' : 'Entra'}</button>
    </form>
  )
}
