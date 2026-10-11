'use client'
import { useActionState } from 'react'
import type { Tavolo } from '@/tavoli/repo'
import { aggiungiTavolo, salvaTavolo, type StatoTavolo } from './azioni'
const INIZIALE: StatoTavolo = { errore: null,salvato: false,valori: null,invii: 0 }
export function ModuloTavolo({ tavolo }: { tavolo?: Tavolo }) {
  const [stato,azione,inCorso] = useActionState(tavolo ? salvaTavolo.bind(null,tavolo.id) : aggiungiTavolo,INIZIALE)
  const v = stato.valori ?? { nome: tavolo?.nome ?? '', posizione: String(tavolo?.posizione ?? 0), attivo: tavolo?.attivo ?? true }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h2 className="heading-sm">{tavolo ? tavolo.nome : 'Aggiungi tavolo'}</h2>
    {tavolo && <p>Slug: <code>{tavolo.slug}</code> · {tavolo.attivo ? 'Attivo' : 'Disattivato'}</p>}
    <label className="campo">Nome<input name="nome" required maxLength={40} defaultValue={v.nome} /></label>
    {tavolo && <><label className="campo">Posizione<input type="number" name="posizione" min={0} step={1} required defaultValue={v.posizione} /></label><label className="admin-tavolo-check"><input type="checkbox" name="attivo" defaultChecked={v.attivo} />Attivo</label></>}
    {stato.errore && <p role="alert">{stato.errore}</p>}{stato.salvato && <p role="status">Salvato.</p>}
    <button className={`ds-btn ${tavolo ? 'ds-btn--secondary' : 'ds-btn--primary'}`} disabled={inCorso}>{inCorso ? 'Salvataggio…' : tavolo ? 'Salva tavolo' : 'Aggiungi tavolo'}</button>
  </form>
}
