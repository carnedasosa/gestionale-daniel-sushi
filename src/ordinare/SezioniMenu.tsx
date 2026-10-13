import type { CategoriaConPiatti } from '@/menu/repo'
import { CardPiatto } from './CardPiatto'
/** Categorie del menù. Senza `modifica` il menù è solo da consultare; `pokeCard` apre la categoria delle poke. */
export function SezioniMenu({ categorie,quantita,modifica,pokeCard }: { categorie: CategoriaConPiatti[]; quantita?: (id: string) => number; modifica?: (id: string,q: number) => void; pokeCard?: React.ReactNode }) {
  return <>
    <nav className="b-menu-nav" aria-label="Categorie del menù"><div className="b-pillole">{categorie.map(c => <a key={c.id} className="b-pillola" href={`#${c.id}`}>{c.nome}</a>)}</div></nav>
    {categorie.map(c => <section key={c.id} id={c.id} className="b-menu-sezione" aria-labelledby={`${c.id}-titolo`}>
      <div className="b-menu-sezione__testa"><h2 id={`${c.id}-titolo`} className="b-titolo-2">{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      {c.id === 'poke-bowl' && pokeCard}
      <div className="b-lista">{c.piatti.map(p => <CardPiatto key={p.id} piatto={p} quantita={quantita?.(p.id) ?? 0} modifica={modifica && (q => modifica(p.id,q))} />)}</div>
    </section>)}
  </>
}
