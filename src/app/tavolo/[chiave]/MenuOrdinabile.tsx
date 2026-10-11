'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti, Piatto } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { testoAllergeni } from '@/menu/testo-allergeni'
import { formatEuro } from '@/domain/soldi'
import type { RigaCarrello } from '@/domain/carrello'
import { ripristinaCarrello, aggiornaCarrello, pokeDaRicomporre, type CarrelloSalvato } from '@/domain/carrello-salvato'
import { pokeOrdinabile, validaPoke, type SceltePoke } from '@/domain/poke'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from './ComponiPoke'
import { Carrello } from './Carrello'
import { inviaOrdine } from './azioni'

export function CardPiatto({ piatto: p,quantita,modifica }: { piatto: Piatto; quantita: number; modifica: (q: number) => void }) {
  return <article className={p.disponibile ? 'dish' : 'dish dish--esaurito'}>
    <span className="dish__num">{p.numero ?? ''}</span><h3 className="dish__name">{p.nome}</h3><span className="dish__price">{formatEuro(p.prezzoCent)}</span>
    {p.descrizione && <p className="dish__desc">{p.descrizione}</p>}
    <div className="dish__tags">{p.dellaCasa && <span className="ds-badge ds-badge--new">Della casa</span>}{p.piccante && <span className="ds-badge ds-badge--spicy">Piccante</span>}{p.vegetariano && <span className="ds-badge ds-badge--veg">Vegetariano</span>}{!p.disponibile && <span className="ds-badge">Esaurito</span>}</div>
    <p className="dish__allergeni">{testoAllergeni(p)}</p>
    {p.disponibile && <div className="tavolo-dish-azioni">{quantita ? <div className="tavolo-quantita"><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Riduci ${p.nome}`} onClick={() => modifica(quantita-1)}>−</button><span aria-live="polite">{quantita}</span><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Aumenta ${p.nome}`} disabled={quantita >= 20} onClick={() => modifica(quantita+1)}>+</button></div> : <button className="ds-btn ds-btn--secondary" type="button" onClick={() => modifica(1)}>Aggiungi<span className="visually-hidden"> {p.nome}</span></button>}</div>}
  </article>
}
export function MenuOrdinabile({ categorie,config,sessioneId,chiave }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string; chiave: string }) {
  const [carrello,setCarrello] = useState<CarrelloSalvato>({ righe: [],chiaveInvio: null })
  const carrelloRef = useRef(carrello)
  const righe = carrello.righe
  const [caricato,setCaricato] = useState(false)
  const [pokeAperta,setPokeAperta] = useState(false)
  const [messaggio,setMessaggio] = useState<string | null>(null)
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const invio = useRef(false)
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const salva = (c: CarrelloSalvato) => { try { sessionStorage.setItem(`carrello_${sessioneId}`,JSON.stringify(c)) } catch { /* Funziona anche in memoria. */ } }
  const modificaRighe = (fn: (r: RigaCarrello[]) => RigaCarrello[]) => {
    if (invio.current || !caricato) return
    const prossimo = aggiornaCarrello(carrelloRef.current,fn(carrelloRef.current.righe),() => crypto.randomUUID())
    carrelloRef.current = prossimo; setCarrello(prossimo); salva(prossimo); setMessaggio(null)
  }
  useEffect(() => {
    let iniziali: CarrelloSalvato = { righe: [],chiaveInvio: null }
    try { iniziali = ripristinaCarrello(sessionStorage.getItem(`carrello_${sessioneId}`) ?? '[]',() => crypto.randomUUID()); sessionStorage.setItem(`carrello_${sessioneId}`,JSON.stringify(iniziali)) } catch { /* Funziona anche solo in memoria. */ }
    carrelloRef.current = iniziali
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ripristino dello stato da storage esterno dopo l'hydration.
    setCarrello(iniziali)
    setCaricato(true)
  },[sessioneId])
  useEffect(() => { if (!messaggio) return; const timer = setTimeout(() => setMessaggio(null),6000); return () => clearTimeout(timer) },[messaggio])
  const modificaPiatto = (id: string,q: number) => {
    if (invio.current || !caricato) return
    setMessaggio(null)
    const i = righe.findIndex(r => r.piattoId === id)
    if (i === -1 && righe.length >= 40) { setErrore('Puoi aggiungere al massimo 40 righe per ordine.'); return }
    modificaRighe(r => q === 0 ? r.filter(v => v.piattoId !== id) : i === -1 ? [...r,{ piattoId: id,quantita: q,nota: '' }] : r.map((v,j) => j === i ? { ...v,quantita: q } : v))
  }
  const aggiungiPoke = (poke: SceltePoke) => {
    if (invio.current || !caricato) return
    setMessaggio(null)
    if (righe.length >= 40) { setErrore('Puoi aggiungere al massimo 40 righe per ordine.'); return }
    modificaRighe(r => [...r,{ piattoId: null,quantita: 1,nota: '',poke }]); setPokeAperta(false)
  }
  const invalidi = pokeDaRicomporre(righe,config)
  const vista = righe.map((r,i) => {
    const p = piatti.find(p => p.id === r.piattoId)
    const poke = config && r.poke ? validaPoke(config,r.poke) : null
    return { ...r,daRicomporre: invalidi.includes(i),nome: r.piattoId === null ? 'Poke composta' : p?.nome ?? 'Piatto non più in menù',prezzoCent: p?.prezzoCent ?? (poke?.ok ? poke.prezzoCent : 0) }
  })
  const invia = () => new Promise<boolean>(risolvi => {
    if (invio.current || !caricato || !carrelloRef.current.chiaveInvio) { risolvi(false); return }
    if (pokeDaRicomporre(carrelloRef.current.righe,config).length) { setErrore('Questa poke va ricomposta: rimuovila e aggiungila di nuovo.'); risolvi(false); return }
    invio.current = true; setErrore(null); setMessaggio(null)
    startTransition(async () => {
      try {
        const esito = await inviaOrdine(chiave,JSON.stringify(carrelloRef.current.righe),carrelloRef.current.chiaveInvio!)
        if (esito.ok) { const vuoto = { righe: [],chiaveInvio: null }; carrelloRef.current = vuoto; setCarrello(vuoto); salva(vuoto); setMessaggio(`Ordine n. ${esito.numero} inviato in cucina`); router.refresh(); risolvi(true) }
        else {
          setErrore(`${esito.errore ?? 'Invio non riuscito.'}${esito.nonDisponibili?.length ? `: ${esito.nonDisponibili.join(', ')}` : ''}`)
          if (esito.nonDisponibiliIds) {
            const prossimo = aggiornaCarrello(carrelloRef.current,carrelloRef.current.righe.filter(v => v.piattoId === null || !esito.nonDisponibiliIds!.includes(v.piattoId)),() => crypto.randomUUID())
            carrelloRef.current = prossimo; setCarrello(prossimo); salva(prossimo)
          }
          risolvi(false); router.refresh()
        }
      } catch { setErrore('Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'); risolvi(false) }
      finally { invio.current = false }
    })
  })
  return <>
    {messaggio && <p role="status" className="tavolo-avviso">{messaggio}</p>}{errore && <p role="alert" className="tavolo-avviso">{errore}</p>}
    <nav className="menu-nav" aria-label="Categorie del menù"><div className="ds-cats">{categorie.map(c => <a key={c.id} className="ds-chip" href={`#${c.id}`}>{c.nome}</a>)}</div></nav>
    {categorie.map(c => <section key={c.id} id={c.id} className="menu-cat" aria-labelledby={`${c.id}-titolo`}><div className="menu-cat__head"><h2 id={`${c.id}-titolo`}>{c.nome}</h2>{c.pezzi && <span className="menu-cat__note">{c.pezzi}</span>}</div><div className="dishes">{c.piatti.map(p => <CardPiatto key={p.id} piatto={p} quantita={righe.find(r => r.piattoId === p.id)?.quantita ?? 0} modifica={q => modificaPiatto(p.id,q)} />)}</div>
      {c.id === 'poke-bowl' && config && pokeOrdinabile(config) && <div className="ds-card tavolo-poke-card"><h3 className="heading-sm">Componi la tua poke</h3><p>Da {formatEuro(config.prezzoBaseCent!)}, con ingredienti a tua scelta.</p><button className="ds-btn ds-btn--secondary" type="button" onClick={() => setPokeAperta(true)}>Componi la tua poke</button></div>}
    </section>)}
    {config && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi la tua poke"><ComponiPoke config={config} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vista} modifica={(i,q) => modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))} nota={(i,nota) => modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={invia} inCorso={inCorso || !caricato} errore={errore} />
  </>
}
