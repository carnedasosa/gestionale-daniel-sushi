import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { contaAllergeniDaConfermare, leggiMenu } from '@/menu/repo'
import { formatEuro } from '@/domain/soldi'
import { testoBannerAllergeni } from '@/menu/testo-banner'
import { cambiaDisponibilita } from './azioni'

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await richiediRuolo('admin')
  const { filtro } = await searchParams
  const soloDaConfermare = filtro === 'allergeni'
  const [menu, daConfermare] = await Promise.all([leggiMenu(db), contaAllergeniDaConfermare(db)])
  const banner = testoBannerAllergeni(daConfermare)

  return (
    <>
      <h1 className="heading">Menù</h1>
      {daConfermare > 0 && (
        <div className="admin-avviso" role="status">
          <strong>{banner.evidenza}</strong> {banner.resto} Senza allergeni confermati gli ordini da casa non possono partire.{' '}
          {soloDaConfermare
            ? <Link className="ds-link" href="/admin/menu">Mostra tutti</Link>
            : <Link className="ds-link" href="/admin/menu?filtro=allergeni">Mostra solo questi</Link>}
        </div>
      )}
      {menu.map((c) => {
        const piatti = soloDaConfermare ? c.piatti.filter((p) => !p.allergeniConfermati) : c.piatti
        if (piatti.length === 0) return null
        return (
          <section key={c.id}>
            <h2 className="heading-sm">{c.nome}</h2>
            <div className="admin-tabella-scroll" role="region" aria-label={`Piatti: ${c.nome}`} tabIndex={0}>
              <table className="admin-tabella-piatti">
                <thead>
                  <tr>
                    <th className="num">N.</th>
                    <th>Piatto</th>
                    <th>Disponibile</th>
                    <th className="admin-colonna-secondaria">Prezzo</th>
                    <th className="admin-colonna-secondaria">Allergeni</th>
                    <th><span className="visually-hidden">Azioni</span></th>
                  </tr>
                </thead>
                <tbody>
                  {piatti.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{p.numero ?? '—'}</td>
                      <td>{p.nome}</td>
                      <td>
                        <form action={cambiaDisponibilita.bind(null, p.id, !p.disponibile)}>
                          <button className="ds-btn ds-btn--secondary">
                            <span className="visually-hidden">{p.nome}: </span>
                            {p.disponibile ? 'Sì' : 'Esaurito'}
                            <span className="visually-hidden"> ({p.disponibile ? 'tocca per segnare esaurito' : 'tocca per rimettere disponibile'})</span>
                          </button>
                        </form>
                      </td>
                      <td className="admin-colonna-secondaria">{formatEuro(p.prezzoCent)}</td>
                      <td className={`admin-colonna-secondaria${p.allergeniConfermati ? '' : ' admin-stato-allergeni--no'}`}>{p.allergeniConfermati ? 'Confermati' : 'Da confermare'}</td>
                      <td><Link className="ds-link" href={`/admin/menu/${p.id}`}>Modifica</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </>
  )
}
