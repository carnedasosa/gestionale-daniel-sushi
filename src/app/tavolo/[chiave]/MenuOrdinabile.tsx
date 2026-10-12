'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { formatEuro } from '@/domain/soldi'
import { aggiornaCarrello, pokeDaRicomporre } from '@/domain/carrello-salvato'
import { pokeOrdinabile, type SceltePoke } from '@/domain/poke'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import { inviaOrdine } from './azioni'

export function MenuOrdinabile({ categorie,config,sessioneId,chiave }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string; chiave: string }) {
  const c = useCarrelloSalvato(`carrello_${sessioneId}`,'session')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  const [messaggio,setMessaggio] = useState<string | null>(null)
  const [errore,setErrore] = useState<string | null>(null)
  const [inCorso,startTransition] = useTransition()
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const modificaRighe: typeof c.modificaRighe = fn => { const fatto = c.modificaRighe(fn); if (fatto) setMessaggio(null); return fatto }
  const modificaPiatto = (id: string,q: number) => {
    if (c.bloccato.current || !c.caricato) return
    setMessaggio(null)
    const e = c.modificaPiatto(id,q)
    if (e) setErrore(e)
  }
  const aggiungiPoke = (poke: SceltePoke) => {
    if (c.bloccato.current || !c.caricato) return
    setMessaggio(null)
    const e = c.aggiungiPoke(poke)
    if (e) setErrore(e); else setPokeAperta(false)
  }
  const invia = () => new Promise<boolean>(risolvi => {
    if (c.bloccato.current || !c.caricato || !c.ref.current.chiaveInvio) { risolvi(false); return }
    if (pokeDaRicomporre(c.ref.current.righe,config).length) { setErrore('Questa poke va ricomposta: rimuovila e aggiungila di nuovo.'); risolvi(false); return }
    c.bloccato.current = true; setErrore(null); setMessaggio(null)
    startTransition(async () => {
      try {
        const esito = await inviaOrdine(chiave,JSON.stringify(c.ref.current.righe),c.ref.current.chiaveInvio!)
        if (esito.ok) { c.svuota(); setMessaggio(`Ordine n. ${esito.numero} inviato in cucina`); router.refresh(); risolvi(true) }
        else {
          setErrore(`${esito.errore ?? 'Invio non riuscito.'}${esito.nonDisponibili?.length ? `: ${esito.nonDisponibili.join(', ')}` : ''}`)
          if (esito.nonDisponibiliIds) c.imposta(aggiornaCarrello(c.ref.current,c.ref.current.righe.filter(v => v.piattoId === null || !esito.nonDisponibiliIds!.includes(v.piattoId)),() => crypto.randomUUID()))
          risolvi(false); router.refresh()
        }
      } catch { setErrore('Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.'); risolvi(false) }
      finally { c.bloccato.current = false }
    })
  })
  const ordinabile = config && pokeOrdinabile(config)
  return <>
    {messaggio && <div className="tavolo-avviso"><p role="status">{messaggio}</p><button type="button" className="ds-btn ds-btn--secondary" onClick={() => setMessaggio(null)}>Fine</button></div>}{errore && <p role="alert" className="tavolo-avviso">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={ordinabile && <div className="ds-card tavolo-poke-card"><h3 className="heading-sm">Componi la tua poke</h3><p>Da {formatEuro(config.prezzoBaseCent!)}, con ingredienti a tua scelta.</p><button className="ds-btn ds-btn--secondary" type="button" onClick={() => setPokeAperta(true)}>Componi la tua poke</button></div>} />
    {ordinabile && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke config={config} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,config)} modifica={(i,q) => modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))} nota={(i,nota) => modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={invia} inCorso={inCorso || !c.caricato} errore={errore} />
  </>
}
