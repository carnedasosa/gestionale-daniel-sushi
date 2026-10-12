'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import type { AllergeniVoci } from '@/domain/allergeni-poke'
import type { SceltePoke } from '@/domain/poke'
import { formatEuro } from '@/domain/soldi'
import { Pannello } from '@/componenti/Pannello'
import { ComponiPoke } from '@/ordinare/ComponiPoke'
import { Carrello } from '@/ordinare/Carrello'
import { SezioniMenu } from '@/ordinare/SezioniMenu'
import { useCarrelloSalvato } from '@/ordinare/useCarrelloSalvato'
import { vistaCarrello } from '@/ordinare/vista-carrello'
import { CHIAVE_CARRELLO_CASA } from '@/ordinare/archivio-casa'
/** Menù ordinabile da casa: il carrello resta nel browser e si conferma nella pagina del riepilogo. */
export function MenuCasa({ categorie,poke }: { categorie: CategoriaConPiatti[]; poke: { config: PokeConfig; allergeni: AllergeniVoci } | null }) {
  const c = useCarrelloSalvato(CHIAVE_CARRELLO_CASA,'local')
  const righe = c.carrello.righe
  const [pokeAperta,setPokeAperta] = useState(false)
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  const piatti = categorie.flatMap(c => c.piatti)
  const modificaPiatto = (id: string,q: number) => { setErrore(c.modificaPiatto(id,q)) }
  const aggiungiPoke = (scelte: SceltePoke) => { const e = c.aggiungiPoke(scelte); setErrore(e); if (!e) setPokeAperta(false) }
  return <>
    {errore && <p role="alert" className="tavolo-avviso">{errore}</p>}
    <SezioniMenu categorie={categorie} quantita={id => righe.find(r => r.piattoId === id)?.quantita ?? 0} modifica={modificaPiatto}
      pokeCard={poke && <div className="ds-card tavolo-poke-card"><h3 className="heading-sm">Componi la tua poke</h3><p>Da {formatEuro(poke.config.prezzoBaseCent!)}, con ingredienti a tua scelta.</p><button className="ds-btn ds-btn--secondary" type="button" onClick={() => setPokeAperta(true)}>Componi la tua poke</button></div>} />
    {poke && <Pannello aperto={pokeAperta} chiudi={() => setPokeAperta(false)} titolo="Componi poke"><ComponiPoke config={poke.config} allergeni={poke.allergeni} aggiungi={aggiungiPoke} /></Pannello>}
    <Carrello righe={vistaCarrello(righe,piatti,poke?.config ?? null)} modifica={(i,q) => c.modificaRighe(r => q === 0 ? r.filter((_,j) => j !== i) : r.map((v,j) => j === i ? { ...v,quantita: q } : v))}
      nota={(i,nota) => c.modificaRighe(r => r.map((v,j) => j === i ? { ...v,nota } : v))} invia={async () => { router.push('/ordina'); return true }} inCorso={!c.caricato} errore={null} azione="Vai al riepilogo" />
  </>
}
