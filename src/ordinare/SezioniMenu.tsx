'use client'
import type { CategoriaConPiatti } from '@/menu/repo'
import { FilaCategorie, useBarraCategorie } from '@/componenti/BarraCategorie'
import { CardPiatto } from './CardPiatto'
/** Categorie del menù. Senza `modifica` il menù è solo da consultare; `pokeCard` apre la categoria delle poke. */
export function SezioniMenu({ categorie,quantita,modifica,pokeCard }: { categorie: CategoriaConPiatti[]; quantita?: (id: string) => number; modifica?: (id: string,q: number) => void; pokeCard?: React.ReactNode }) {
  const { fila:rifFila,pillole:rifPillole,...fila } = useBarraCategorie(categorie.map(c => c.id))
  return <>
    {categorie.length > 0 && <FilaCategorie categorie={categorie} rifFila={rifFila} rifPillole={rifPillole} stato={fila} className="b-menu-nav" />}
    {categorie.map(c => <section key={c.id} id={`sez-${c.id}`} className="b-menu-sezione" aria-labelledby={`cat-${c.id}`}>
      <div className="b-menu-sezione__testa"><h2 id={`cat-${c.id}`} className="b-titolo-2" tabIndex={-1}>{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      {c.id === 'poke-bowl' && pokeCard}
      <div className="b-lista">{c.piatti.map(p => <CardPiatto key={p.id} piatto={p} quantita={quantita?.(p.id) ?? 0} modifica={modifica && (q => modifica(p.id,q))} />)}</div>
    </section>)}
  </>
}
