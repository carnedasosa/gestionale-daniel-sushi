'use client'
import type { CategoriaConPiatti, Piatto } from '@/menu/repo'
import { ETICHETTA_TIPOLOGIA, raggruppaVini } from '@/domain/vini'
import { FilaCategorie, useBarraCategorie } from '@/componenti/BarraCategorie'
import { CardPiatto } from './CardPiatto'
/** Categorie del menù. Senza `modifica` il menù è solo da consultare; `pokeCard` apre la categoria delle poke. */
// La carta dei vini compare solo quando ha almeno un vino (la categoria nasce vuota con la migrazione).
export function SezioniMenu({ categorie: tutte,quantita,modifica,pokeCard }: { categorie: CategoriaConPiatti[]; quantita?: (id: string) => number; modifica?: (id: string,q: number) => void; pokeCard?: React.ReactNode }) {
  const categorie = tutte.filter(c => c.tipo !== 'vini' || c.piatti.length > 0)
  const { fila:rifFila,pillole:rifPillole,...fila } = useBarraCategorie(categorie.map(c => c.id))
  const card = (p: Piatto) => <CardPiatto key={p.id} piatto={p} quantita={quantita?.(p.id) ?? 0} modifica={modifica && (q => modifica(p.id,q))} />
  return <>
    {categorie.length > 0 && <FilaCategorie categorie={categorie} rifFila={rifFila} rifPillole={rifPillole} stato={fila} className="b-menu-nav" />}
    {categorie.map(c => <section key={c.id} id={`sez-${c.id}`} className="b-menu-sezione" aria-labelledby={`cat-${c.id}`}>
      <div className="b-menu-sezione__testa"><h2 id={`cat-${c.id}`} className="b-titolo-2" tabIndex={-1}>{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      {c.id === 'poke-bowl' && pokeCard}
      {c.tipo === 'vini'
        ? raggruppaVini(c.piatti).map(g => <div key={g.tipologia ?? 'altri'} className="b-vini-gruppo">
            {g.tipologia && <h3 className="b-vini-gruppo__titolo">{ETICHETTA_TIPOLOGIA[g.tipologia]}</h3>}
            <div className="b-lista">{g.voci.map(card)}</div>
          </div>)
        : <div className="b-lista">{c.piatti.map(card)}</div>}
    </section>)}
  </>
}
