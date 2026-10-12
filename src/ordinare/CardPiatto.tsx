import type { Piatto } from '@/menu/repo'
import { testoAllergeni } from '@/menu/testo-allergeni'
import { formatEuro } from '@/domain/soldi'
export function CardPiatto({ piatto: p,quantita,modifica }: { piatto: Piatto; quantita: number; modifica: (q: number) => void }) {
  return <article className={p.disponibile ? 'dish' : 'dish dish--esaurito'}>
    <span className="dish__num">{p.numero ?? ''}</span><h3 className="dish__name">{p.nome}</h3><span className="dish__price">{formatEuro(p.prezzoCent)}</span>
    {p.descrizione && <p className="dish__desc">{p.descrizione}</p>}
    <div className="dish__tags">{p.dellaCasa && <span className="ds-badge ds-badge--new">Della casa</span>}{p.piccante && <span className="ds-badge ds-badge--spicy">Piccante</span>}{p.vegetariano && <span className="ds-badge ds-badge--veg">Vegetariano</span>}{!p.disponibile && <span className="ds-badge">Esaurito</span>}</div>
    <p className="dish__allergeni">{testoAllergeni(p)}</p>
    {p.disponibile && <div className="tavolo-dish-azioni">{quantita ? <div className="tavolo-quantita"><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Riduci ${p.nome}`} onClick={() => modifica(quantita-1)}>−</button><span aria-live="polite">{quantita}</span><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Aumenta ${p.nome}`} disabled={quantita >= 20} onClick={() => modifica(quantita+1)}>+</button></div> : <button className="ds-btn ds-btn--secondary" type="button" onClick={() => modifica(1)}>Aggiungi<span className="visually-hidden"> {p.nome}</span></button>}</div>}
  </article>
}
