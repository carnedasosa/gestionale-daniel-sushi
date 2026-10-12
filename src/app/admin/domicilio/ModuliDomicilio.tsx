'use client'
import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatEuro } from '@/domain/soldi'
import type { ImpostazioniCasa, Zona } from '@/casa/impostazioni-repo'
import { GIORNI } from '@/domain/valida-domicilio'
import { aggiungiChiusuraCasa, aggiungiOrarioCasa, salvaImpostazioniCasa, salvaZonaCasa, type EsitoAdmin, type StatoModulo } from './azioni'
const INIZIALE: StatoModulo = { errore: null,salvato: false,valori: null,invii: 0 }
const euro = (cent: number) => formatEuro(cent).replace(/\s*€$/,'')
function Esito({ stato }: { stato: StatoModulo }) {
  return <>{stato.errore && <p role="alert">{stato.errore}</p>}{stato.salvato && <p role="status">Salvato.</p>}</>
}
export function ModuloImpostazioni({ impostazioni: i }: { impostazioni: ImpostazioniCasa }) {
  const [stato,azione,inCorso] = useActionState(salvaImpostazioniCasa,INIZIALE)
  const v = stato.valori ?? { capacitaFascia: String(i.capacitaFascia),capacitaConsegne: String(i.capacitaConsegne),anticipoMinuti: String(i.anticipoMinuti),telefono: i.telefono ?? '' }
  return <form key={stato.invii} action={azione} className="admin-modulo-piatto ds-card">
    <label className="campo">Ordini da casa per fascia di 15 minuti<input type="number" name="capacitaFascia" min={1} max={50} required defaultValue={v.capacitaFascia} /></label>
    <label className="campo">Di questi, al massimo a domicilio<input type="number" name="capacitaConsegne" min={0} max={50} required defaultValue={v.capacitaConsegne} /></label>
    <label className="campo">Anticipo minimo (minuti)<input type="number" name="anticipoMinuti" min={0} max={240} required defaultValue={v.anticipoMinuti} /></label>
    <label className="campo">Telefono del locale (mostrato ai clienti)<input type="tel" name="telefono" maxLength={20} defaultValue={v.telefono} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Salva impostazioni'}</button>
  </form>
}
export function ModuloZona({ zona }: { zona?: Zona }) {
  const [stato,azione,inCorso] = useActionState(salvaZonaCasa.bind(null,zona?.id ?? null),INIZIALE)
  const v = stato.valori ?? { nome: zona?.nome ?? '',costo: zona ? euro(zona.costoCent) : '',minimo: zona ? euro(zona.minimoCent) : '',posizione: String(zona?.posizione ?? 0),attiva: zona && !zona.attiva ? '' : 'on' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">{zona ? zona.nome : 'Aggiungi zona'}</h3>
    <label className="campo">Nome<input name="nome" required maxLength={60} defaultValue={v.nome} /></label>
    <label className="campo">Costo di consegna (€)<input name="costo" inputMode="decimal" required defaultValue={v.costo} /></label>
    <label className="campo">Ordine minimo (€)<input name="minimo" inputMode="decimal" required defaultValue={v.minimo} /></label>
    <label className="campo">Posizione<input type="number" name="posizione" min={0} max={999} required defaultValue={v.posizione} /></label>
    <label className="admin-tavolo-check"><input type="checkbox" name="attiva" defaultChecked={v.attiva === 'on'} />Attiva</label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : zona ? 'Salva zona' : 'Aggiungi zona'}</button>
  </form>
}
export function ModuloOrario() {
  const [stato,azione,inCorso] = useActionState(aggiungiOrarioCasa,INIZIALE)
  const v = stato.valori ?? { servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">Aggiungi turno</h3>
    <label className="campo">Servizio<select name="servizio" defaultValue={v.servizio}><option value="asporto">Asporto</option><option value="domicilio">Domicilio</option></select></label>
    <label className="campo">Giorno<select name="giorno" defaultValue={v.giorno}>{GIORNI.map((g,i) => <option key={g} value={i + 1}>{g}</option>)}</select></label>
    <label className="campo">Dalle<input type="time" name="dalle" step={900} required defaultValue={v.dalle} /></label>
    <label className="campo">Alle<input type="time" name="alle" step={900} required defaultValue={v.alle} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Aggiungi turno'}</button>
  </form>
}
export function ModuloChiusura() {
  const [stato,azione,inCorso] = useActionState(aggiungiChiusuraCasa,INIZIALE)
  const v = stato.valori ?? { data: '',motivo: '' }
  return <form key={stato.invii} action={azione} className="admin-tavolo ds-card">
    <h3 className="heading-sm">Aggiungi chiusura</h3>
    <label className="campo">Data<input type="date" name="data" required defaultValue={v.data} /></label>
    <label className="campo">Motivo (facoltativo)<input name="motivo" maxLength={100} defaultValue={v.motivo} /></label>
    <Esito stato={stato} />
    <button className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso}>{inCorso ? 'Salvataggio in corso…' : 'Aggiungi chiusura'}</button>
  </form>
}
export function BottoneRimuovi({ etichetta,rimuovi }: { etichetta: string; rimuovi: () => Promise<EsitoAdmin> }) {
  const [inCorso,start] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  return <>
    <button type="button" className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso} onClick={() => start(async () => {
      setErrore(null)
      try { const e = await rimuovi(); if (!e.ok) setErrore(e.errore ?? 'Operazione non riuscita.'); router.refresh() }
      catch { setErrore('Operazione non riuscita, riprova.') }
    })}>Rimuovi<span className="visually-hidden"> {etichetta}</span></button>
    {errore && <span role="alert"> {errore}</span>}
  </>
}
