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
import { BarraBasso } from '@/componenti/BarraBasso'
export interface ServizioCheckout { aperto: boolean; motivo: string | null; fasce: string[]; piene: string[] }
export interface DisponibilitaCheckout { servizi: Record<Servizio,ServizioCheckout>; zone: Zona[] }
// Con tutti gli orari pieni il servizio è chiuso ma si può scegliere per vederli barrati (la conferma resta bloccata).
export const siSceglie = (s: ServizioCheckout) => s.aperto || s.piene.length > 0
const ERRORE_INCERTO = 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'
function Errore({ campo,errori }: { campo: CampoCheckout; errori: ErroriCheckout }) {
  return errori[campo] ? <p className="b-errore" id={`errore-${campo}`}>{errori[campo]}</p> : null
}
export function Checkout({ piatti,poke,disponibilita: d }: { piatti: Piatto[]; poke: PokeConfig | null; disponibilita: DisponibilitaCheckout }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASA,'local')
  const router = useRouter()
  const [tipo,setTipo] = useState<Servizio>(d.servizi.asporto.aperto || (!d.servizi.domicilio.aperto && (siSceglie(d.servizi.asporto) || !siSceglie(d.servizi.domicilio))) ? 'asporto' : 'domicilio')
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
  if (inviato) return <p role="status" className="b-avviso b-avviso--pronto">Ordine inviato: ti portiamo alla pagina dell’ordine…</p>
  if (c.caricato && !righe.length) return <div className="b-avviso"><p>Il carrello è vuoto.</p><Link className="b-btn b-btn--secondario" href="/">Scegli i piatti dal menù</Link></div>
  const attesa = inCorso || !c.caricato
  const orari = [...fasce.map(f => ({ f,piena: false })),...servizio.piene.filter(f => !fasce.includes(f)).map(f => ({ f,piena: true }))].sort((a,b) => a.f.localeCompare(b.f))
  const quando = tipo === 'domicilio' ? 'Consegna verso le' : 'Ritiro alle'
  const passo = (n: number) => <span className="b-passo b-num" aria-hidden="true">{n}</span>
  return <form className="b-checkout" onSubmit={invia} noValidate>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(1)}Come lo ricevi?</legend>
      <div className="b-scelte">{(['asporto','domicilio'] as const).map(s => <label key={s} className="b-scelta">
        <input type="radio" name="tipo" value={s} checked={tipo === s} disabled={!siSceglie(d.servizi[s]) || attesa} onChange={() => setTipo(s)} aria-label={s === 'asporto' ? 'Ritiro al locale (asporto)' : 'Consegna a domicilio'} />
        <span className="b-scelta__testi"><span>{s === 'asporto' ? 'Ritiro al locale' : 'A domicilio'}</span>
          <span className="b-scelta__sotto">{!d.servizi[s].aperto && d.servizi[s].motivo ? d.servizi[s].motivo : s === 'asporto' ? 'Via Beato Giacomo 72' : 'Paghi alla consegna'}</span></span>
      </label>)}</div>
      <Errore campo="tipo" errori={errori} />
    </fieldset>
    {tipo === 'domicilio' && <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(2)}Dove lo portiamo?</legend>
      <label className="b-campo">Zona<select value={campi.zonaId} onChange={imposta('zonaId')} disabled={attesa} aria-invalid={!!errori.zonaId}>
        <option value="">Scegli la zona</option>{d.zone.map(z => <option key={z.id} value={z.id}>{z.nome} · consegna {formatEuro(z.costoCent)} · minimo {formatEuro(z.minimoCent)}</option>)}</select></label>
      <Errore campo="zonaId" errori={errori} />
      <label className="b-campo">Indirizzo e numero civico<input value={campi.indirizzo} onChange={imposta('indirizzo')} maxLength={200} autoComplete="street-address" disabled={attesa} aria-invalid={!!errori.indirizzo} /></label>
      <Errore campo="indirizzo" errori={errori} />
      <label className="b-campo">Citofono, piano, note per il fattorino (facoltativo)<input value={campi.noteConsegna} onChange={imposta('noteConsegna')} maxLength={200} disabled={attesa} placeholder="Citofono Rossi, 2° piano" /></label>
      <Errore campo="noteConsegna" errori={errori} />
    </fieldset>}
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 3 : 2)}A che ora, circa?</legend>
      {!fasce.length && <p>Nessun orario libero per oggi.</p>}
      {orari.length > 0 && <div className="b-orari" role="radiogroup" aria-label={quando} aria-invalid={!!errori.fascia}>{orari.map(({ f,piena }) => <label key={f} className={piena ? 'b-orario b-orario--pieno' : 'b-orario'}>
        <input type="radio" name="fascia" value={f} checked={fascia === f} disabled={piena || attesa} onChange={imposta('fascia')} />
        {piena ? <><s>{oraRoma(new Date(f))}</s><span className="b-nascosto"> pieno</span></> : <span className="b-num">{oraRoma(new Date(f))}</span>}
      </label>)}</div>}
      {orari.some(o => o.piena) && <p className="b-secondario b-piccolo">Gli orari barrati sono già pieni.</p>}
      <Errore campo="fascia" errori={errori} />
    </fieldset>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 4 : 3)}Chi sei?</legend>
      <label className="b-campo">Nome<input value={campi.nome} onChange={imposta('nome')} maxLength={60} autoComplete="name" disabled={attesa} aria-invalid={!!errori.nome} /></label>
      <Errore campo="nome" errori={errori} />
      <label className="b-campo">Telefono<input type="tel" value={campi.telefono} onChange={imposta('telefono')} maxLength={20} autoComplete="tel" disabled={attesa} aria-invalid={!!errori.telefono} /></label>
      <Errore campo="telefono" errori={errori} />
      <label className="b-campo">Email (per la conferma)<input type="email" value={campi.email} onChange={imposta('email')} maxLength={254} autoComplete="email" disabled={attesa} aria-invalid={!!errori.email} /></label>
      <Errore campo="email" errori={errori} />
    </fieldset>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 5 : 4)}Come paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}?</legend>
      <div className="b-scelte">
        <label className="b-scelta"><input type="radio" name="pagamento" value="contanti" checked={campi.pagamento === 'contanti'} disabled={attesa} onChange={imposta('pagamento')} />Contanti</label>
        <label className="b-scelta"><input type="radio" name="pagamento" value="carta" checked={campi.pagamento === 'carta'} disabled={attesa} onChange={imposta('pagamento')} />Carta (POS)</label>
      </div>
      <Errore campo="pagamento" errori={errori} />
      {campi.pagamento === 'contanti' && <label className="b-campo">Paghi con (facoltativo, per il resto)<input inputMode="decimal" value={campi.contantiDa} onChange={imposta('contantiDa')} placeholder="50" disabled={attesa} aria-invalid={!!errori.contantiDa} /></label>}
      <Errore campo="contantiDa" errori={errori} />
    </fieldset>
    <section className="b-card" aria-labelledby="riepilogo-titolo"><h2 id="riepilogo-titolo" className="b-titolo-3">Il tuo ordine</h2>
      <div className="b-scontrino">{vista.map((r,i) => <div className="b-scontrino__riga" key={`${r.piattoId}-${i}`}><span><span className="b-num">{r.quantita}×</span> {r.nome}{r.nota && <span className="b-secondario"> · {r.nota}</span>}</span><span className="b-num">{r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</span></div>)}
        {tipo === 'domicilio' && zona && <div className="b-scontrino__riga b-secondario"><span>Consegna · {zona.nome}</span><span className="b-num">{formatEuro(totali.consegnaCent)}</span></div>}
        <div className="b-scontrino__totale"><span>Totale</span><span className="b-num">{formatEuro(totali.totaleCent)}</span></div></div>
      <p className="b-secondario b-piccolo">Paghi {tipo === 'domicilio' ? 'alla consegna' : 'al ritiro'}. Nessun pagamento online.</p>
      <Link className="b-btn b-btn--discreto" href="/">Modifica il carrello</Link>
      {vista.some(r => r.daRicomporre) && <p role="alert" className="b-errore">La poke composta non si può ordinare online in questo momento: tornando al menù, rimuovila dal carrello.</p>}
      {nonDisponibili.length > 0 && <div role="alert" className="b-avviso b-avviso--ritardo"><p>Alcuni piatti non sono più disponibili.</p><button type="button" className="b-btn b-btn--secondario" onClick={togliNonDisponibili}>Togli i piatti non disponibili</button></div>}
      {totali.mancanteCent > 0 && zona && <p role="alert" className="b-errore">Mancano {formatEuro(totali.mancanteCent)} per l’ordine minimo di {zona.nome}.</p>}
    </section>
    <label className="b-checkout__privacy"><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} disabled={attesa} aria-invalid={!!errori.privacy} /><span>Ho letto l’<Link href="/privacy" target="_blank">informativa privacy</Link></span></label>
    <Errore campo="privacy" errori={errori} />
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
    <BarraBasso>
      <button className="b-btn b-btn--principale b-btn--barra" aria-busy={inCorso} disabled={attesa || bloccato} aria-label={inCorso ? undefined : `Conferma l’ordine · ${formatEuro(totali.totaleCent)}`}>{inCorso ? 'Invio in corso…' : <><span>Conferma l’ordine</span><span className="b-num">{formatEuro(totali.totaleCent)}</span></>}</button>
    </BarraBasso>
  </form>
}
