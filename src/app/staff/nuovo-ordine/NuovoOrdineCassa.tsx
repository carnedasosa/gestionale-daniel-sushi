'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { Zona } from '@/casa/impostazioni-repo'
import type { Occupazione, RegoleFasce, Servizio } from '@/domain/fasce'
import type { SceltePoke } from '@/domain/poke'
import { CardPoke } from '@/ordinare/CardPoke'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import { ModuloCassa } from './ModuloCassa'
/** `forzabile`: aperto, oppure chiuso solo perché le fasce sono tutte piene (la cassa può forzare). */
export interface ServizioCassa { aperto: boolean; motivo: string | null; forzabile: boolean; fasce: string[]; future: string[] }
export interface DisponibilitaCassa { servizi: Record<Servizio,ServizioCassa>; zone: Zona[]; occupazione: Occupazione[]; regole: RegoleFasce }
export const CHIAVE_CARRELLO_CASSA = 'ds_carrello_cassa'
/** Menù ordinabile dalla cassa: il carrello resta nella scheda; «Dati del cliente» apre il modulo e invia. */
export function NuovoOrdineCassa({ categorie,poke,disponibilita }: { categorie: CategoriaConPiatti[]; poke: PokeConfig | null; disponibilita: DisponibilitaCassa }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASSA,'session')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  // Cambia a ogni poke aggiunta: la successiva riparte dalla base invece che dalle scelte di prima.
  const [pokeAggiunte,setPokeAggiunte] = useState(0)
  const [datiAperti,setDatiAperti] = useState(false)
  const [errore,setErrore] = useState<string | null>(null)
  const [inviato,setInviato] = useState<number | null>(null)
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const modificaPiatto = (id: string,q: number) => { setErrore(c.modificaPiatto(id,q)) }
  const aggiungiPoke = (scelte: SceltePoke) => { const e = c.aggiungiPoke(scelte); setErrore(e); if (!e) { setPokeAperta(false); setPokeAggiunte(n => n + 1) } }
  const inviatoConNumero = (numero: number) => { setDatiAperti(false); c.svuota(); setInviato(numero); router.refresh() }
  if (inviato !== null) return <div className="b-avviso b-avviso--pronto b-nuovo-ordine__fatto" role="status">
    <p><strong>Ordine n. {inviato} in cucina.</strong> È già accettato: lo trovi in «Da preparare».</p>
    <div className="b-azioni"><Link href="/staff" className="b-btn b-btn--principale">Torna allo schermo</Link><button type="button" className="b-btn b-btn--secondario" onClick={() => setInviato(null)}>Altro ordine</button></div>
  </div>
  return <>
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={poke && <CardPoke config={poke} apri={() => setPokeAperta(true)} />} />
    {poke && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke key={pokeAggiunte} config={poke} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,poke)} modifica={(i,q) => c.modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))}
      nota={(i,nota) => c.modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={async () => { setDatiAperti(true); return true }} inCorso={!c.caricato} errore={null} azione="Dati del cliente" etichettaBarra="Rivedi l’ordine" />
    <Pannello aperto={datiAperti} chiudi={() => setDatiAperti(false)} titolo="Dati del cliente">
      {datiAperti && <ModuloCassa carrello={c} piatti={piatti} poke={poke} disponibilita={disponibilita} inviato={inviatoConNumero} />}
    </Pannello>
  </>
}
