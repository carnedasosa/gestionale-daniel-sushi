'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import type { Tavolo } from '@/tavoli/repo'
import { aggiungiTavolo, salvaTavolo, nuovoQr, type StatoTavolo } from './azioni'
const INIZIALE: StatoTavolo = { errore: null,salvato: false,valori: null,invii: 0 }
export function ModuloTavolo({ tavolo,url }: { tavolo?: Tavolo; url?: string }) {
  const [qrInCorso,startQr] = useTransition()
  const [erroreQr,setErroreQr] = useState<string | null>(null)
  const router = useRouter()
  const [stato,azione,inCorso] = useActionState(tavolo ? salvaTavolo.bind(null,tavolo.id) : aggiungiTavolo,INIZIALE)
  const v = stato.valori ?? { nome: tavolo?.nome ?? '', posizione: String(tavolo?.posizione ?? 0), attivo: tavolo?.attivo ?? true }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h2 className="heading-sm">{tavolo ? tavolo.nome : 'Aggiungi tavolo'}</h2>
    {tavolo && <p>Slug: <code>{tavolo.slug}</code> · {tavolo.attivo ? 'Attivo' : 'Disattivato'}</p>}
    {tavolo && <><p><a className="ds-link" href={url}>{url}</a></p><ConfermaAzione inCorso={qrInCorso || inCorso} domanda="I QR stampati di questo tavolo smetteranno di funzionare. Generare un nuovo QR?" conferma={() => startQr(async () => {
      setErroreQr(null)
      try { const e = await nuovoQr(tavolo.id); if (!e.ok) setErroreQr(e.errore ?? 'Nuovo QR non riuscito.'); router.refresh() }
      catch { setErroreQr('Nuovo QR non riuscito, riprova.') }
    })}>Nuovo QR</ConfermaAzione>{erroreQr && <p role="alert">{erroreQr}</p>}</>}
    <label className="campo">Nome<input name="nome" required maxLength={40} defaultValue={v.nome} /></label>
    {tavolo && <><label className="campo">Posizione<input type="number" name="posizione" min={0} step={1} required defaultValue={v.posizione} /></label><label className="admin-tavolo-check"><input type="checkbox" name="attivo" defaultChecked={v.attivo} />Attivo</label></>}
    {stato.errore && <p role="alert">{stato.errore}</p>}{stato.salvato && <p role="status">Salvato.</p>}
    <button className={`ds-btn ${tavolo ? 'ds-btn--secondary' : 'ds-btn--primary'}`} aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : tavolo ? 'Salva tavolo' : 'Aggiungi tavolo'}</button>
  </form>
}
