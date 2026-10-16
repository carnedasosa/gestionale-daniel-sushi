'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Piatto } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { Servizio } from '@/domain/fasce'
import { totaliCasa, type CampoCheckout, type ErroriCheckout } from '@/domain/checkout'
import { aggiornaCarrello } from '@/domain/carrello-salvato'
import { formatEuro } from '@/domain/soldi'
import type { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { totaleVista, vistaCarrello } from '@/ordinare/vista-carrello'
import { OrariFascia, type OrarioFascia } from '@/ordinare/OrariFascia'
import { inviaOrdineCassa } from '../azioni-cassa'
import type { DisponibilitaCassa } from './NuovoOrdineCassa'
const ERRORE_INCERTO = 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'
function Errore({ campo,errori }: { campo: CampoCheckout; errori: ErroriCheckout }) {
  return errori[campo] ? <p className="b-errore" id={`errore-${campo}`}>{errori[campo]}</p> : null
}
/** Dati dell'ordine dettato alla cassa: come il checkout del sito, ma senza privacy, con email facoltativa e orari pieni forzabili. */
export function ModuloCassa({ carrello: c,piatti,poke,disponibilita: d,inviato }: { carrello: ReturnType<typeof useCarrelloSalvato>; piatti: Piatto[]; poke: PokeConfig | null; disponibilita: DisponibilitaCassa; inviato: (numero: number) => void }) {
  const router = useRouter()
  const [tipo,setTipo] = useState<Servizio>(d.servizi.asporto.forzabile || !d.servizi.domicilio.forzabile ? 'asporto' : 'domicilio')
  const [campi,setCampi] = useState({ zonaId: '',indirizzo: '',noteConsegna: '',fascia: '',nome: '',telefono: '',email: '',pagamento: '',contantiDa: '' })
  const [forza,setForza] = useState(false)
  const [errori,setErrori] = useState<ErroriCheckout>({})
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const imposta = (campo: keyof typeof campi) => (e: { target: { value: string } }) => setCampi(v => ({ ...v,[campo]: e.target.value }))
  const servizio = d.servizi[tipo]
  const occupata = (f: string) => d.occupazione.find(o => o.fascia === f)
  const orari: OrarioFascia[] = servizio.future.map(f => { const o = occupata(f)
    return { f,piena: !servizio.fasce.includes(f),sotto: tipo === 'domicilio' ? `${o?.totale ?? 0}/${d.regole.capacitaFascia} · dom. ${o?.domicilio ?? 0}/${d.regole.capacitaConsegne}` : `${o?.totale ?? 0}/${d.regole.capacitaFascia}` } })
  const scelte = orari.filter(o => forza || !o.piena).map(o => o.f)
  const fascia = scelte.includes(campi.fascia) ? campi.fascia : ''
  const righe = c.carrello.righe
  const vista = vistaCarrello(righe,piatti,poke)
  const nonDisponibili = righe.filter(r => r.piattoId !== null && !piatti.find(p => p.id === r.piattoId)?.disponibile)
  const zona = tipo === 'domicilio' ? d.zone.find(z => z.id === campi.zonaId) ?? null : null
  const totali = totaliCasa(totaleVista(vista),tipo,zona)
  const aperto = servizio.aperto || (forza && servizio.forzabile)
  const bloccato = !righe.length || vista.some(r => r.daRicomporre) || nonDisponibili.length > 0 || totali.mancanteCent > 0 || !aperto
  const togliNonDisponibili = () => c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || piatti.find(p => p.id === r.piattoId)?.disponibile),() => crypto.randomUUID()))
  const invia = (e: React.FormEvent) => {
    e.preventDefault()
    if (bloccato || !c.blocca()) return
    setErrore(null); setErrori({})
    const dati = { tipo,...campi,fascia,forzaFascia: forza }
    startTransition(async () => {
      try {
        const esito = await inviaOrdineCassa(JSON.stringify({ righe: c.ref.current.righe,dati,totaleVistoCent: totali.totaleCent,chiaveInvio: c.ref.current.chiaveInvio }))
        if (esito.ok && esito.numero !== undefined) { inviato(esito.numero); return }
        setErrore(esito.errore ?? 'Invio non riuscito, riprova.'); setErrori(esito.errori ?? {})
        if (esito.nonDisponibiliIds) c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(r => r.piattoId === null || !esito.nonDisponibiliIds!.includes(r.piattoId)),() => crypto.randomUUID()))
        // Fasce, prezzi o disponibilità cambiati: la pagina si rilegge dal server.
        if (esito.fasce || esito.totaleCent !== undefined || esito.nonDisponibiliIds) router.refresh()
      } catch { setErrore(ERRORE_INCERTO) }
      finally { c.sblocca() }
    })
  }
  const attesa = inCorso || !c.caricato
  const passo = (n: number) => <span className="b-passo b-num" aria-hidden="true">{n}</span>
  return <form className="b-checkout b-checkout--cassa" onSubmit={invia} noValidate>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(1)}Asporto o domicilio?</legend>
      <div className="b-scelte">{(['asporto','domicilio'] as const).map(s => <label key={s} className="b-scelta">
        <input type="radio" name="tipo" value={s} checked={tipo === s} disabled={!d.servizi[s].forzabile || attesa} onChange={() => setTipo(s)} aria-label={s === 'asporto' ? 'Ritiro al locale (asporto)' : 'Consegna a domicilio'} />
        <span className="b-scelta__testi"><span>{s === 'asporto' ? 'Ritiro al locale' : 'A domicilio'}</span>
          {!d.servizi[s].aperto && d.servizi[s].motivo && <span className="b-scelta__sotto">{d.servizi[s].motivo}</span>}</span>
      </label>)}</div>
      <Errore campo="tipo" errori={errori} />
    </fieldset>
    {tipo === 'domicilio' && <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(2)}Dove?</legend>
      <label className="b-campo">Zona<select value={campi.zonaId} onChange={imposta('zonaId')} disabled={attesa} aria-invalid={!!errori.zonaId}>
        <option value="">Scegli la zona</option>{d.zone.map(z => <option key={z.id} value={z.id}>{z.nome} · consegna {formatEuro(z.costoCent)} · minimo {formatEuro(z.minimoCent)}</option>)}</select></label>
      <Errore campo="zonaId" errori={errori} />
      <label className="b-campo">Indirizzo e numero civico<input value={campi.indirizzo} onChange={imposta('indirizzo')} maxLength={200} disabled={attesa} aria-invalid={!!errori.indirizzo} /></label>
      <Errore campo="indirizzo" errori={errori} />
      <label className="b-campo">Citofono, piano, note per il fattorino (facoltativo)<input value={campi.noteConsegna} onChange={imposta('noteConsegna')} maxLength={200} disabled={attesa} /></label>
      <Errore campo="noteConsegna" errori={errori} />
    </fieldset>}
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 3 : 2)}A che ora?</legend>
      {!orari.length && <p>Nessun orario di oggi ancora da venire.</p>}
      {orari.length > 0 && <OrariFascia orari={orari} valore={fascia} onChange={f => setCampi(v => ({ ...v,fascia: f }))} disabilitato={attesa} etichetta={tipo === 'domicilio' ? 'Consegna verso le' : 'Ritiro alle'} invalido={!!errori.fascia} forzati={forza} className="b-orari--cassa" />}
      <p className="b-secondario b-piccolo">Sotto ogni orario: ordini già presi su quelli disponibili{tipo === 'domicilio' && ', e le consegne'}. Gli orari barrati sono pieni o troppo vicini.</p>
      {orari.some(o => o.piena) && <label className="b-checkout__privacy"><input type="checkbox" checked={forza} onChange={e => setForza(e.target.checked)} disabled={attesa} /><span>Forza: accetta anche un orario pieno o troppo vicino (il sito lo vedrà pieno)</span></label>}
      <Errore campo="fascia" errori={errori} />
    </fieldset>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 4 : 3)}Chi è?</legend>
      <label className="b-campo">Nome<input value={campi.nome} onChange={imposta('nome')} maxLength={60} disabled={attesa} aria-invalid={!!errori.nome} /></label>
      <Errore campo="nome" errori={errori} />
      <label className="b-campo">Telefono<input type="tel" value={campi.telefono} onChange={imposta('telefono')} maxLength={20} disabled={attesa} aria-invalid={!!errori.telefono} /></label>
      <Errore campo="telefono" errori={errori} />
      <label className="b-campo">Email <span className="b-campo__facoltativo">(facoltativa, non riceve nulla)</span><input type="email" value={campi.email} onChange={imposta('email')} maxLength={254} disabled={attesa} aria-invalid={!!errori.email} /></label>
      <Errore campo="email" errori={errori} />
    </fieldset>
    <fieldset className="b-card b-checkout__blocco"><legend className="b-checkout__titolo">{passo(tipo === 'domicilio' ? 5 : 4)}Come paga?</legend>
      <div className="b-scelte">
        <label className="b-scelta"><input type="radio" name="pagamento" value="contanti" checked={campi.pagamento === 'contanti'} disabled={attesa} onChange={imposta('pagamento')} />Contanti</label>
        <label className="b-scelta"><input type="radio" name="pagamento" value="carta" checked={campi.pagamento === 'carta'} disabled={attesa} onChange={imposta('pagamento')} />Carta (POS)</label>
      </div>
      <Errore campo="pagamento" errori={errori} />
      {campi.pagamento === 'contanti' && <label className="b-campo">Paga con (facoltativo, per il resto)<input inputMode="decimal" value={campi.contantiDa} onChange={imposta('contantiDa')} placeholder="50" disabled={attesa} aria-invalid={!!errori.contantiDa} /></label>}
      <Errore campo="contantiDa" errori={errori} />
    </fieldset>
    <section className="b-card" aria-labelledby="riepilogo-cassa"><h2 id="riepilogo-cassa" className="b-titolo-3">Riepilogo</h2>
      <div className="b-scontrino">{vista.map((r,i) => <div className="b-scontrino__riga" key={`${r.piattoId}-${i}`}><span><span className="b-num">{r.quantita}×</span> {r.nome}{r.nota && <span className="b-secondario"> · {r.nota}</span>}</span><span className="b-num">{r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</span></div>)}
        {tipo === 'domicilio' && zona && <div className="b-scontrino__riga b-secondario"><span>Consegna · {zona.nome}</span><span className="b-num">{formatEuro(totali.consegnaCent)}</span></div>}
        <div className="b-scontrino__totale"><span>Totale</span><span className="b-num">{formatEuro(totali.totaleCent)}</span></div></div>
      {vista.some(r => r.daRicomporre) && <p role="alert" className="b-errore">Una poke composta non è più valida: rimuovila dal carrello e ricomponila.</p>}
      {nonDisponibili.length > 0 && <div role="alert" className="b-avviso b-avviso--ritardo"><p>Alcuni piatti sono esauriti.</p><button type="button" className="b-btn b-btn--secondario" onClick={togliNonDisponibili}>Togli i piatti esauriti</button></div>}
      {totali.mancanteCent > 0 && zona && <p role="alert" className="b-errore">Mancano {formatEuro(totali.mancanteCent)} per l’ordine minimo di {zona.nome}.</p>}
      {!aperto && servizio.motivo && <p role="alert" className="b-errore">{servizio.motivo}</p>}
    </section>
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
    <button className="b-btn b-btn--principale b-btn--barra b-btn--largo" aria-busy={inCorso} disabled={attesa || bloccato} aria-label={inCorso ? undefined : `Manda in cucina · ${formatEuro(totali.totaleCent)}`}>{inCorso ? 'Invio in corso…' : <><span>Manda in cucina</span><span className="b-num">{formatEuro(totali.totaleCent)}</span></>}</button>
  </form>
}
