'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Piatto } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { Zona } from '@/casa/impostazioni-repo'
import type { Servizio } from '@/domain/fasce'
import { totaliCasa, type CampoCheckout, type ErroriCheckout } from '@/domain/checkout'
import { aggiornaCarrello } from '@/domain/carrello-salvato'
import { formatEuro } from '@/domain/soldi'
import { oraRoma } from '@/domain/ora-roma'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { totaleVista, vistaCarrello } from '@/ordinare/vista-carrello'
import { CHIAVE_CARRELLO_CASA, CHIAVE_ULTIMO_ORDINE } from '@/ordinare/archivio-casa'
import { inviaOrdineCasa } from './azioni'
export interface ServizioCheckout { aperto: boolean; motivo: string | null; fasce: string[] }
export interface DisponibilitaCheckout { servizi: Record<Servizio,ServizioCheckout>; zone: Zona[] }
const ERRORE_INCERTO = 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'
function Errore({ campo,errori }: { campo: CampoCheckout; errori: ErroriCheckout }) {
  return errori[campo] ? <p className="casa-errore" id={`errore-${campo}`}>{errori[campo]}</p> : null
}
export function Checkout({ piatti,poke,disponibilita: d }: { piatti: Piatto[]; poke: PokeConfig | null; disponibilita: DisponibilitaCheckout }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASA,'local')
  const router = useRouter()
  const [tipo,setTipo] = useState<Servizio>(d.servizi.asporto.aperto || !d.servizi.domicilio.aperto ? 'asporto' : 'domicilio')
  const [campi,setCampi] = useState({ zonaId: '',indirizzo: '',noteConsegna: '',fascia: '',nome: '',telefono: '',email: '',pagamento: '',contantiDa: '' })
  const [privacy,setPrivacy] = useState(false)
  const [fasceNuove,setFasceNuove] = useState<Partial<Record<Servizio,string[]>>>({})
  const [errori,setErrori] = useState<ErroriCheckout>({})
  const [errore,setErrore] = useState<string | null>(null)
  const [inviato,setInviato] = useState(false)
  const [inCorso,startTransition] = useTransition()
  const imposta = (campo: keyof typeof campi) => (e: { target: { value: string } }) => setCampi(v => ({ ...v,[campo]: e.target.value }))
  const servizio = d.servizi[tipo]
  const fasce = fasceNuove[tipo] ?? servizio.fasce
  const fascia = fasce.includes(campi.fascia) ? campi.fascia : ''
  const righe = c.carrello.righe
  const vista = vistaCarrello(righe,piatti,poke)
  const nonDisponibili = righe.filter(r => r.piattoId !== null && !piatti.find(p => p.id === r.piattoId)?.disponibile)
  const zona = tipo === 'domicilio' ? d.zone.find(z => z.id === campi.zonaId) ?? null : null
  const totali = totaliCasa(totaleVista(vista),tipo,zona)
  const bloccato = !righe.length || vista.some(r => r.daRicomporre) || nonDisponibili.length > 0 || totali.mancanteCent > 0 || !servizio.aperto
  const togliNonDisponibili = () => c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || piatti.find(p => p.id === r.piattoId)?.disponibile),() => crypto.randomUUID()))
  const invia = (e: React.FormEvent) => {
    e.preventDefault()
    if (bloccato || !c.blocca()) return
    setErrore(null); setErrori({})
    const dati = { tipo,...campi,fascia,privacy }
    startTransition(async () => {
      try {
        const esito = await inviaOrdineCasa(JSON.stringify({ righe: c.ref.current.righe,dati,totaleVistoCent: totali.totaleCent,chiaveInvio: c.ref.current.chiaveInvio }))
        if (esito.ok && esito.token) {
          setInviato(true); c.svuota()
          try { localStorage.setItem(CHIAVE_ULTIMO_ORDINE,JSON.stringify({ token: esito.token,numero: esito.numero,salvatoIl: Date.now() })) } catch { /* Facoltativo. */ }
          router.push(`/ordine/${esito.token}`)
          return
        }
        setErrore(esito.errore ?? 'Invio non riuscito, riprova.'); setErrori(esito.errori ?? {})
        if (esito.fasce) setFasceNuove(f => ({ ...f,[tipo]: esito.fasce }))
        if (esito.nonDisponibiliIds) c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || !esito.nonDisponibiliIds!.includes(r.piattoId)),() => crypto.randomUUID()))
        if (esito.totaleCent !== undefined || esito.nonDisponibiliIds) router.refresh()
      } catch { setErrore(ERRORE_INCERTO) }
      finally { c.sblocca() }
    })
  }
  if (inviato) return <p role="status" className="casa-avviso">Ordine inviato: ti portiamo alla pagina dell’ordine…</p>
  if (c.caricato && !righe.length) return <div className="casa-avviso"><p>Il carrello è vuoto.</p><Link className="ds-link" href="/">Scegli i piatti dal menù</Link></div>
  const attesa = inCorso || !c.caricato
  return <form className="casa-modulo" onSubmit={invia} noValidate>
    <p><Link className="ds-link" href="/">← Torna al menù per modificare il carrello</Link></p>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Come vuoi ricevere l’ordine?</legend>
      {(['asporto','domicilio'] as const).map(s => <label key={s} className="tavolo-scelta"><input type="radio" name="tipo" value={s} checked={tipo === s} disabled={!d.servizi[s].aperto || attesa} onChange={() => setTipo(s)} />
        {s === 'asporto' ? 'Ritiro al locale (asporto)' : 'Consegna a domicilio'}{!d.servizi[s].aperto && d.servizi[s].motivo && <span className="casa-nota"> · {d.servizi[s].motivo}</span>}</label>)}
      <Errore campo="tipo" errori={errori} />
    </fieldset>
    {tipo === 'domicilio' && <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Dove lo consegniamo?</legend>
      <label className="campo">Zona<select value={campi.zonaId} onChange={imposta('zonaId')} disabled={attesa} aria-invalid={!!errori.zonaId}>
        <option value="">Scegli la zona</option>{d.zone.map(z => <option key={z.id} value={z.id}>{z.nome} · consegna {formatEuro(z.costoCent)} · minimo {formatEuro(z.minimoCent)}</option>)}</select></label>
      <Errore campo="zonaId" errori={errori} />
      <label className="campo">Indirizzo e numero civico<input value={campi.indirizzo} onChange={imposta('indirizzo')} maxLength={200} autoComplete="street-address" disabled={attesa} aria-invalid={!!errori.indirizzo} /></label>
      <Errore campo="indirizzo" errori={errori} />
      <label className="campo">Citofono, piano, note per il fattorino (facoltativo)<textarea value={campi.noteConsegna} onChange={imposta('noteConsegna')} maxLength={200} rows={2} disabled={attesa} /></label>
      <Errore campo="noteConsegna" errori={errori} />
    </fieldset>}
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Quando?</legend>
      {fasce.length ? <label className="campo">{tipo === 'domicilio' ? 'Consegna verso le' : 'Ritiro alle'}<select value={fascia} onChange={imposta('fascia')} disabled={attesa} aria-invalid={!!errori.fascia}>
        <option value="">Scegli l’orario</option>{fasce.map(f => <option key={f} value={f}>{oraRoma(new Date(f))}</option>)}</select></label> : <p>Nessun orario libero per oggi.</p>}
      <Errore campo="fascia" errori={errori} />
    </fieldset>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">I tuoi dati</legend>
      <label className="campo">Nome<input value={campi.nome} onChange={imposta('nome')} maxLength={60} autoComplete="name" disabled={attesa} aria-invalid={!!errori.nome} /></label>
      <Errore campo="nome" errori={errori} />
      <label className="campo">Telefono<input type="tel" value={campi.telefono} onChange={imposta('telefono')} maxLength={20} autoComplete="tel" disabled={attesa} aria-invalid={!!errori.telefono} /></label>
      <Errore campo="telefono" errori={errori} />
      <label className="campo">Email (per la conferma)<input type="email" value={campi.email} onChange={imposta('email')} maxLength={254} autoComplete="email" disabled={attesa} aria-invalid={!!errori.email} /></label>
      <Errore campo="email" errori={errori} />
    </fieldset>
    <fieldset className="ds-card casa-sezione"><legend className="heading-sm">Come paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}?</legend>
      <label className="tavolo-scelta"><input type="radio" name="pagamento" value="contanti" checked={campi.pagamento === 'contanti'} disabled={attesa} onChange={imposta('pagamento')} />Contanti</label>
      <label className="tavolo-scelta"><input type="radio" name="pagamento" value="carta" checked={campi.pagamento === 'carta'} disabled={attesa} onChange={imposta('pagamento')} />Carta (POS)</label>
      <Errore campo="pagamento" errori={errori} />
      {campi.pagamento === 'contanti' && <label className="campo">Paghi con (facoltativo, per il resto)<input inputMode="decimal" value={campi.contantiDa} onChange={imposta('contantiDa')} placeholder="es. 50" disabled={attesa} aria-invalid={!!errori.contantiDa} /></label>}
      <Errore campo="contantiDa" errori={errori} />
    </fieldset>
    <section className="ds-card casa-sezione" aria-labelledby="riepilogo-titolo"><h2 id="riepilogo-titolo" className="heading-sm">Riepilogo</h2>
      <ul className="casa-riepilogo">{vista.map((r,i) => <li key={`${r.piattoId}-${i}`}><span>{r.quantita} × {r.nome}{r.nota && <span className="casa-nota"> · {r.nota}</span>}</span><span>{r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</span></li>)}
        {tipo === 'domicilio' && zona && <li><span>Consegna · {zona.nome}</span><span>{formatEuro(totali.consegnaCent)}</span></li>}</ul>
      <p className="casa-totale"><span>Totale</span><strong>{formatEuro(totali.totaleCent)}</strong></p>
      <p>Paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}. Nessun pagamento online.</p>
      {vista.some(r => r.daRicomporre) && <p role="alert" className="casa-errore">La poke composta non si può ordinare online in questo momento: tornando al menù, rimuovila dal carrello.</p>}
      {nonDisponibili.length > 0 && <div role="alert"><p className="casa-errore">Alcuni piatti non sono più disponibili.</p><button type="button" className="ds-btn ds-btn--secondary" onClick={togliNonDisponibili}>Togli i piatti non disponibili</button></div>}
      {totali.mancanteCent > 0 && zona && <p role="alert" className="casa-errore">Mancano {formatEuro(totali.mancanteCent)} per l’ordine minimo di {zona.nome}.</p>}
    </section>
    <label className="tavolo-scelta"><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} disabled={attesa} aria-invalid={!!errori.privacy} /><span>Ho letto l’<Link className="ds-link" href="/privacy" target="_blank">informativa privacy</Link></span></label>
    <Errore campo="privacy" errori={errori} />
    {errore && <p role="alert" className="casa-avviso">{errore}</p>}
    <button className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={attesa || bloccato}>{inCorso ? 'Invio in corso…' : `Conferma l’ordine · ${formatEuro(totali.totaleCent)}`}</button>
  </form>
}
