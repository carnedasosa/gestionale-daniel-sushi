'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pannello } from '@/componenti/Pannello'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { formatEuro, parseEuro } from '@/domain/soldi'
import { allaRomana, ETICHETTA_METODO, MAX_PERSONE, METODI_PAGAMENTO, type MetodoPagamento, type VoceDivisibile } from '@/domain/divisione-conto'
import type { Destinazione, ModoPagamento, RichiestaPagamento } from '@/cassa/pagamenti-repo'
import { annullaIncasso, incassa } from './azioni-pagamenti'

export interface PagamentoClient { id: string; importoCent: number; metodo: MetodoPagamento; descrizione: string; annullato: boolean }
export interface DatiIncasso {
  dest: Destinazione; totaleCent: number; pagatoCent: number; residuoCent: number; pagamenti: PagamentoClient[]
  /** Solo per i tavoli: voci con le porzioni ancora da pagare e i coperti residui. */
  voci: (VoceDivisibile & { chiave: string; residue: number })[]; copertoCent: number; copertiResidui: number
}
const SCHEDE: { modo: ModoPagamento; testo: string; soloTavolo: boolean }[] = [
  { modo: 'tutto',testo: 'Tutto',soloTavolo: false },{ modo: 'romana',testo: 'Alla romana',soloTavolo: true },
  { modo: 'piatti',testo: 'Per piatti',soloTavolo: true },{ modo: 'importo',testo: 'Importo',soloTavolo: false },
]

function Passo({ valore,min,max,cambia,etichetta }: { valore: number; min: number; max: number; cambia: (n: number) => void; etichetta: string }) {
  return <div className="b-quantita b-quantita--chiara" role="group" aria-label={etichetta}>
    <button type="button" className="b-quantita__btn" aria-label={`${etichetta}: meno`} disabled={valore <= min} onClick={() => cambia(valore - 1)}>−</button>
    <span className="b-num" aria-live="polite">{valore}</span>
    <button type="button" className="b-quantita__btn" aria-label={`${etichetta}: più`} disabled={valore >= max} onClick={() => cambia(valore + 1)}>+</button>
  </div>
}

/** Pagamenti del conto e pannello «Incassa»: tutto, alla romana sul residuo, per piatti, importo libero. Il server ricalcola ogni importo. */
export function Incasso({ dati: d }: { dati: DatiIncasso }) {
  const [aperto,setAperto] = useState(false)
  const [modo,setModo] = useState<ModoPagamento>('tutto')
  const [persone,setPersone] = useState(2)
  const [scelte,setScelte] = useState<Record<string,number>>({})
  const [coperti,setCoperti] = useState(0)
  const [importo,setImporto] = useState('')
  const [esito,setEsito] = useState<{ errore: string | null; fatto: string | null }>({ errore: null,fatto: null })
  const [inCorso,startTransition] = useTransition()
  const router = useRouter()
  const tavolo = 'sessioneId' in d.dest
  const residuo = Math.max(0,d.residuoCent)

  const quotaCent: number | null = modo === 'tutto' ? residuo
    : modo === 'romana' ? (residuo > 0 ? allaRomana(residuo,persone)[0] : null)
    : modo === 'piatti' ? d.voci.reduce((s,v) => s + (scelte[v.chiave] ?? 0) * v.prezzoUnitCent,0) + coperti * d.copertoCent
    : parseEuro(importo)
  const valida = quotaCent !== null && quotaCent > 0 && quotaCent <= residuo
  const richiesta = (): RichiestaPagamento => modo === 'romana' ? { modo,persone } : modo === 'importo' ? { modo,importoCent: quotaCent! }
    : modo === 'piatti' ? { modo,porzioni: Object.entries(scelte).filter(([,q]) => q > 0).map(([chiave,quantita]) => ({ chiave,quantita })),coperti } : { modo: 'tutto' }

  const paga = (metodo: MetodoPagamento) => startTransition(async () => {
    setEsito({ errore: null,fatto: null })
    try {
      const e = await incassa(d.dest,richiesta(),metodo)
      if (!e.ok) { setEsito({ errore: e.errore ?? 'Incasso non registrato, riprova.',fatto: null }); router.refresh(); return }
      setEsito({ errore: null,fatto: `Incassati ${formatEuro(quotaCent!)} (${ETICHETTA_METODO[metodo].toLowerCase()}).` })
      if (modo === 'romana' && persone > 1) setPersone(persone - 1)
      else if (modo !== 'romana') setAperto(false)
      setScelte({}); setCoperti(0); setImporto('')
      router.refresh()
    } catch { setEsito({ errore: 'Incasso non registrato, riprova.',fatto: null }) }
  })
  const togli = (id: string) => startTransition(async () => {
    try { const e = await annullaIncasso(id); setEsito({ errore: e.ok ? null : e.errore ?? 'Operazione non riuscita.',fatto: null }); router.refresh() }
    catch { setEsito({ errore: 'Operazione non riuscita, riprova.',fatto: null }) }
  })

  return <section className="b-incasso" aria-labelledby="titolo-incasso">
    <div className="b-incasso__testa">
      <h2 id="titolo-incasso" className="b-titolo-3">Pagamenti</h2>
      <p className="b-num">{d.residuoCent < 0 ? <>Da restituire <strong>{formatEuro(-d.residuoCent)}</strong></> : d.residuoCent === 0 && d.pagatoCent > 0 ? <strong>Saldato</strong> : <>Resta da pagare <strong>{formatEuro(d.residuoCent)}</strong></>}</p>
    </div>
    {d.pagamenti.length > 0 && <ul className="b-incasso__elenco">{d.pagamenti.map(p => <li key={p.id} className={p.annullato ? 'b-incasso__voce b-incasso__voce--tolto' : 'b-incasso__voce'}>
      <span>{p.descrizione} · {ETICHETTA_METODO[p.metodo]}{p.annullato && ' · tolto'}</span>
      <span className="b-num">{formatEuro(p.importoCent)}</span>
      {!p.annullato && <ConfermaAzione stile="discreto" inCorso={inCorso} domanda={`Togliere l’incasso di ${formatEuro(p.importoCent)} (${p.descrizione})? Resta nello storico come tolto.`} conferma={() => togli(p.id)}>Togli</ConfermaAzione>}
    </li>)}</ul>}
    {esito.fatto && !aperto && <p role="status" className="b-secondario">{esito.fatto}</p>}
    {esito.errore && !aperto && <p role="alert" className="b-errore">{esito.errore}</p>}
    {d.residuoCent > 0 && <button type="button" className="b-btn b-btn--principale b-btn--staff" onClick={() => { setEsito({ errore: null,fatto: null }); setAperto(true) }}>Incassa</button>}
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Incassa">
      <div className="b-incasso__pannello">
        <div className="b-schede" role="group" aria-label="Come si paga">{SCHEDE.filter(s => tavolo || !s.soloTavolo).map(s =>
          <button key={s.modo} type="button" className="b-scheda" aria-current={modo === s.modo} onClick={() => setModo(s.modo)}>{s.testo}</button>)}</div>
        <p className="b-secondario">Resta da pagare <span className="b-num">{formatEuro(residuo)}</span></p>
        {modo === 'romana' && <div className="b-incasso__riga"><span>Persone che devono ancora pagare</span><Passo valore={persone} min={1} max={MAX_PERSONE} cambia={setPersone} etichetta="Persone" /></div>}
        {modo === 'romana' && residuo > 0 && <p className="b-secondario">Quote: <span className="b-num">{allaRomana(residuo,persone).map(formatEuro).join(' · ')}</span></p>}
        {modo === 'piatti' && <ul className="b-incasso__piatti">
          {d.voci.filter(v => v.residue > 0).map(v => <li key={v.chiave} className="b-incasso__riga">
            <span>{v.numero !== null && <span className="b-num b-secondario">{v.numero} </span>}{v.nome} <span className="b-num b-secondario">{formatEuro(v.prezzoUnitCent)}</span>{v.residue < v.quantita && <span className="b-secondario"> · {v.residue} di {v.quantita} da pagare</span>}</span>
            <Passo valore={scelte[v.chiave] ?? 0} min={0} max={v.residue} cambia={n => setScelte({ ...scelte,[v.chiave]: n })} etichetta={v.nome} />
          </li>)}
          {d.copertiResidui > 0 && d.copertoCent > 0 && <li className="b-incasso__riga"><span>Coperto <span className="b-num b-secondario">{formatEuro(d.copertoCent)}</span></span><Passo valore={coperti} min={0} max={d.copertiResidui} cambia={setCoperti} etichetta="Coperti" /></li>}
        </ul>}
        {modo === 'importo' && <label className="b-campo">Importo (€)<input inputMode="decimal" value={importo} onChange={e => setImporto(e.target.value)} /></label>}
        <p className="b-incasso__quota">Da incassare <span className="b-num">{valida ? formatEuro(quotaCent!) : '—'}</span></p>
        {quotaCent !== null && quotaCent > residuo && <p role="alert" className="b-errore">L’importo supera quanto resta da pagare.</p>}
        {esito.fatto && <p role="status" className="b-secondario">{esito.fatto}</p>}
        {esito.errore && <p role="alert" className="b-errore">{esito.errore}</p>}
        <div className="b-azioni b-azioni--fine">{METODI_PAGAMENTO.map(m => <button key={m} type="button" className="b-btn b-btn--principale b-btn--staff" disabled={!valida || inCorso} aria-busy={inCorso} onClick={() => paga(m)}>{ETICHETTA_METODO[m]}</button>)}</div>
      </div>
    </Pannello>
  </section>
}
