import { formatEuro } from '@/domain/soldi'
import type { CategoriaConPiatti } from '@/menu/repo'
import { testoAllergeni } from '@/menu/testo-allergeni'

export function MenuCliente({ categorie }: { categorie: CategoriaConPiatti[] }) {
  return (
    <>
      <nav className="menu-nav" aria-label="Categorie del menù">
        <div className="ds-cats">
          {categorie.map((c) => (
            <a key={c.id} className="ds-chip" href={`#${c.id}`}>{c.nome}</a>
          ))}
        </div>
      </nav>
      {categorie.map((c) => (
        <section key={c.id} className="menu-cat" id={c.id} aria-labelledby={`${c.id}-titolo`}>
          <div className="menu-cat__head">
            <h2 id={`${c.id}-titolo`}>{c.nome}</h2>
            {c.pezzi && <span className="menu-cat__note">{c.pezzi}</span>}
          </div>
          <div className="dishes">
            {c.piatti.map((p) => (
              <article key={p.id} className={p.disponibile ? 'dish' : 'dish dish--esaurito'}>
                <span className="dish__num">{p.numero ?? ''}</span>
                <h3 className="dish__name">{p.nome}</h3>
                <span className="dish__price">{formatEuro(p.prezzoCent)}</span>
                {p.descrizione && <p className="dish__desc">{p.descrizione}</p>}
                {(p.piccante || p.vegetariano || p.dellaCasa) && (
                  <div className="dish__tags">
                    {p.dellaCasa && <span className="ds-badge ds-badge--new">Della casa</span>}
                    {p.piccante && <span className="ds-badge ds-badge--spicy">Piccante</span>}
                    {p.vegetariano && <span className="ds-badge ds-badge--veg">Vegetariano</span>}
                  </div>
                )}
                <p className="dish__allergeni">{testoAllergeni(p)}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
