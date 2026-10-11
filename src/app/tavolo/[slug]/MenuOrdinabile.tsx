'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti, Piatto } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { testoAllergeni } from '@/menu/testo-allergeni'
import { formatEuro } from '@/domain/soldi'
import { validaCarrello, type RigaCarrello } from '@/domain/carrello'
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
export function MenuOrdinabile({ categorie,config,sessioneId,slug }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string; slug: string }) {
  const [righe,setRighe] = useState<RigaCarrello[]>([])
  const [caricato,setCaricato] = useState(false)
  const [pokeAperta,setPokeAperta] = useState(false)
  const [messaggio,setMessaggio] = useState<string | null>(null)
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const invio = useRef(false)
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  useEffect(() => {
    let iniziali: RigaCarrello[] = []
    try { const v = validaCarrello(JSON.parse(sessionStorage.getItem(`carrello_${sessioneId}`) ?? '[]')); if (v.ok) iniziali = v.righe } catch { /* Funziona anche solo in memoria. */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ripristino dello stato da storage esterno dopo l'hydration.
    setRighe(iniziali)
    setCaricato(true)
  },[sessioneId])
  useEffect(() => { if (caricato) { try { sessionStorage.setItem(`carrello_${sessioneId}`,JSON.stringify(righe)) } catch { /* Storage non disponibile. */ } } },[righe,sessioneId,caricato])
  const modificaPiatto = (id: string,q: number) => {
    if (invio.current || !caricato) return
    setMessaggio(null)
    const i = righe.findIndex(r => r.piattoId === id)
    if (i === -1 && righe.length >= 40) { setErrore('Puoi aggiungere al massimo 40 righe per ordine.'); return }
    setRighe(r => q === 0 ? r.filter(v => v.piattoId !== id) : i === -1 ? [...r,{ piattoId: id,quantita: q,nota: '' }] : r.map((v,j) => j === i ? { ...v,quantita: q } : v))
  }
  const aggiungiPoke = (poke: SceltePoke) => {
    if (invio.current || !caricato) return
    setMessaggio(null)
    if (righe.length >= 40) { setErrore('Puoi aggiungere al massimo 40 righe per ordine.'); return }
    setRighe(r => [...r,{ piattoId: null,quantita: 1,nota: '',poke }]); setPokeAperta(false)
  }
  const vista = righe.map(r => {
    const p = piatti.find(p => p.id === r.piattoId)
    const poke = config && r.poke ? validaPoke(config,r.poke) : null
    return { ...r,nome: r.piattoId === null ? 'Poke composta' : p?.nome ?? 'Piatto non più in menù',prezzoCent: p?.prezzoCent ?? (poke?.ok ? poke.prezzoCent : 0) }
  })
  const invia = () => new Promise<boolean>(risolvi => {
    if (invio.current) { risolvi(false); return }
    invio.current = true; setErrore(null); setMessaggio(null)
    startTransition(async () => {
      try {
        const esito = await inviaOrdine(slug,JSON.stringify(righe))
        if (esito.ok) { setRighe([]); setMessaggio(`Ordine n. ${esito.numero} inviato in cucina`); router.refresh(); risolvi(true) }
        else {
          setErrore(`${esito.errore ?? 'Invio non riuscito.'}${esito.nonDisponibili?.length ? `: ${esito.nonDisponibili.join(', ')}` : ''}`)
          if (esito.nonDisponibiliIds) setRighe(r => r.filter(v => v.piattoId === null || !esito.nonDisponibiliIds!.includes(v.piattoId)))
          risolvi(false); router.refresh()
        }
      } catch { setErrore('Invio non riuscito: controlla la connessione e riprova.'); risolvi(false) }
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
    <Carrello righe={vista} modifica={(i,q) => setRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))} nota={(i,nota) => setRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={invia} inCorso={inCorso} errore={errore} />
  </>
}
