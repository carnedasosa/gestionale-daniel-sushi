import type { CategoriaConPiatti } from '@/menu/repo'
import { CardPiatto } from './CardPiatto'
/** Categorie del menù con i piatti ordinabili; `pokeCard` compare in fondo alla categoria delle poke. */
export function SezioniMenu({ categorie,quantita,modifica,pokeCard }: { categorie: CategoriaConPiatti[]; quantita: (id: string) => number; modifica: (id: string,q: number) => void; pokeCard?: React.ReactNode }) {
  return <>
    <nav className="menu-nav" aria-label="Categorie del menù"><div className="ds-cats">{categorie.map(c => <a key={c.id} className="ds-chip" href={`#${c.id}`}>{c.nome}</a>)}</div></nav>
    {categorie.map(c => <section key={c.id} id={c.id} className="menu-cat" aria-labelledby={`${c.id}-titolo`}><div className="menu-cat__head"><h2 id={`${c.id}-titolo`}>{c.nome}</h2>{c.pezzi && <span className="menu-cat__note">{c.pezzi}</span>}</div><div className="dishes">{c.piatti.map(p => <CardPiatto key={p.id} piatto={p} quantita={quantita(p.id)} modifica={q => modifica(p.id,q)} />)}</div>
      {c.id === 'poke-bowl' && pokeCard}
    </section>)}
  </>
}
