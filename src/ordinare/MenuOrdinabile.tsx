'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { CardPoke } from '@/ordinare/CardPoke'
import { aggiornaCarrello, pokeDaRicomporre } from '@/domain/carrello-salvato'
import { pokeOrdinabile, type SceltePoke } from '@/domain/poke'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import type { EsitoInvio } from './esito-invio'

/**
 * Menù con carrello e invio in cucina per un tavolo, usato dal telefono del cliente e dal cameriere.
 * `chiaveStorage`: dove il carrello resta salvato nella scheda; `invia`: la Server Action che crea l'ordine (le closure non passano da un Server Component, per questo i due wrapper).
 */
export function MenuOrdinabile({ categorie,config,chiaveStorage,invia: inviaOrdine,etichettaBarra = 'Rivedi e manda in cucina' }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; chiaveStorage: string; invia: (righeJson: string,chiaveInvio: string) => Promise<EsitoInvio>; etichettaBarra?: string }) {
  const c = useCarrelloSalvato(chiaveStorage,'session')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  // Cambia a ogni poke aggiunta: la successiva riparte dalla base invece che dalle scelte di prima.
  const [pokeAggiunte,setPokeAggiunte] = useState(0)
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
    if (e) setErrore(e); else { setPokeAperta(false); setPokeAggiunte(n => n + 1) }
  }
  const invia = () => new Promise<boolean>(risolvi => {
    if (c.bloccato.current || !c.caricato || !c.ref.current.chiaveInvio) { risolvi(false); return }
    if (pokeDaRicomporre(c.ref.current.righe,config).length) { setErrore('Questa poke va ricomposta: rimuovila e aggiungila di nuovo.'); risolvi(false); return }
    c.bloccato.current = true; setErrore(null); setMessaggio(null)
    startTransition(async () => {
      try {
        const esito = await inviaOrdine(JSON.stringify(c.ref.current.righe),c.ref.current.chiaveInvio!)
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
    {messaggio && <div className="b-avviso b-avviso--pronto"><p role="status">{messaggio}</p><button type="button" className="b-btn b-btn--secondario" onClick={() => setMessaggio(null)}>Fine</button></div>}{errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={ordinabile && <CardPoke config={config} apri={() => setPokeAperta(true)} />} />
    {ordinabile && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke key={pokeAggiunte} config={config} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,config)} modifica={(i,q) => modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))} nota={(i,nota) => modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={invia} inCorso={inCorso || !c.caricato} errore={errore} etichettaBarra={etichettaBarra} />
  </>
}
