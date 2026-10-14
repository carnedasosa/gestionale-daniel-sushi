'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import type { Tavolo } from '@/tavoli/repo'
import { aggiungiTavolo, salvaTavolo, nuovoQr, type StatoTavolo } from './azioni'
const INIZIALE: StatoTavolo = { errore: null,salvato: false,valori: null,invii: 0 }
// `qr`: SVG del QR già generato dal server (assente se APP_URL non è valido).
export function ModuloTavolo({ tavolo,url,qr }: { tavolo?: Tavolo; url?: string; qr?: string }) {
  const [qrInCorso,startQr] = useTransition()
  const [erroreQr,setErroreQr] = useState<string | null>(null)
  const router = useRouter()
  const [stato,azione,inCorso] = useActionState(tavolo ? salvaTavolo.bind(null,tavolo.id) : aggiungiTavolo,INIZIALE)
  const v = stato.valori ?? { nome: tavolo?.nome ?? '', posizione: String(tavolo?.posizione ?? 0), attivo: tavolo?.attivo ?? true }
  return <form key={stato.invii} action={azione} className={`b-card b-admin-modulo${tavolo && !tavolo.attivo ? ' b-tavolo-admin--spento' : ''}`}>
    {tavolo && <div className="b-tavolo-admin__testa">
      <div className="b-qr-mini" role="img" aria-label={`QR di ${tavolo.nome}`}>{qr ? <span dangerouslySetInnerHTML={{ __html: qr }} /> : 'QR non disponibile'}</div>
      <div className="b-admin-sezione"><h2 className="b-titolo-2">{tavolo.nome}</h2>
        <span className={`b-etichetta ${tavolo.attivo ? 'b-etichetta--pronto' : ''}`}>{tavolo.attivo ? 'Attivo' : 'Disattivato'}</span>
        {url && <a className="b-link-qr" href={url}>{url}</a>}</div>
    </div>}
    <div className={tavolo ? 'b-campi-riga' : 'b-admin-modulo'}>
      <label className="b-campo">Nome<input name="nome" required maxLength={40} defaultValue={v.nome} /></label>
      {tavolo && <label className="b-campo">Ordine<input type="number" name="posizione" min={0} step={1} required defaultValue={v.posizione} className="b-num" /></label>}
    </div>
    {tavolo && <label className="b-interruttore"><input className="b-interruttore__input" type="checkbox" role="switch" name="attivo" defaultChecked={v.attivo} /><span className="b-interruttore__binario" aria-hidden="true" />Attivo (compare nello schermo staff)</label>}
    {stato.errore && <p role="alert" className="b-errore">{stato.errore}</p>}{stato.salvato && <p role="status" className="b-secondario">Salvato.</p>}
    <div className="b-azioni">
      <button className={`b-btn ${tavolo ? 'b-btn--secondario' : 'b-btn--principale'}`} aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : tavolo ? 'Salva' : 'Aggiungi tavolo'}</button>
      {tavolo && <ConfermaAzione inCorso={qrInCorso || inCorso} domanda="I QR stampati di questo tavolo smetteranno di funzionare e i clienti seduti dovranno scansionare il nuovo QR. Generare un nuovo QR?" conferma={() => startQr(async () => {
        setErroreQr(null)
        try { const e = await nuovoQr(tavolo.id); if (!e.ok) setErroreQr(e.errore ?? 'Nuovo QR non riuscito.'); router.refresh() }
        catch { setErroreQr('Nuovo QR non riuscito, riprova.') }
      })}>Nuovo QR</ConfermaAzione>}
    </div>
    {erroreQr && <p role="alert" className="b-errore">{erroreQr}</p>}
  </form>
}
