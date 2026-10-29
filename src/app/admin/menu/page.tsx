import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { contaAllergeniDaConfermare, leggiMenu } from '@/menu/repo'
import { testoBannerAllergeni } from '@/menu/testo-banner'
import { cambiaDisponibilita, cambiaRepartoCategoria } from './azioni'
import { ElencoPiatti } from './ElencoPiatti'

export default async function AdminMenu({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await richiediRuolo('admin')
  const { filtro } = await searchParams
  const [menu, daConfermare] = await Promise.all([leggiMenu(db), contaAllergeniDaConfermare(db)])
  const banner = testoBannerAllergeni(daConfermare)
  const tutti = menu.flatMap((c) => c.piatti)
  const esauriti = tutti.filter((p) => !p.disponibile).length
  const tiene = (p: { allergeniConfermati: boolean; disponibile: boolean }) => filtro === 'allergeni' ? !p.allergeniConfermati : filtro === 'esauriti' ? !p.disponibile : true
  const categorie = menu.map((c) => ({ id: c.id, nome: c.nome, pezzi: c.pezzi, reparto: c.reparto, piatti: c.piatti.filter(tiene).map((p) => ({ id: p.id, numero: p.numero, nome: p.nome, prezzoCent: p.prezzoCent, allergeniConfermati: p.allergeniConfermati, disponibile: p.disponibile })) })).filter((c) => c.piatti.length)
  const scheda = (valore: string | undefined, testo: string, n?: number) => (
    <Link className="b-scheda" href={valore ? `/admin/menu?filtro=${valore}` : '/admin/menu'} aria-current={filtro === valore || (!valore && filtro !== 'allergeni' && filtro !== 'esauriti') ? 'page' : undefined}>
      {testo}{n !== undefined && <span className="b-num">{n}</span>}
    </Link>
  )

  return (
    <>
      <div className="b-admin-testa">
        <div className="b-admin-testa__testi"><h1 className="b-titolo-1">Menù</h1><p className="b-secondario">{tutti.length} piatti in {menu.length} categorie</p></div>
        <div className="b-azioni"><Link className="b-btn b-btn--secondario" href="/admin/menu/nuovo?categoria=vini">Nuovo vino</Link><Link className="b-btn b-btn--principale" href="/admin/menu/nuovo">Nuovo piatto</Link></div>
      </div>
      {daConfermare > 0 && (
        <div className="b-avviso b-avviso--accettare" role="status">
          <p><strong>{banner.evidenza}</strong> {banner.resto} Senza allergeni confermati gli ordini da casa non possono partire.</p>
          {filtro === 'allergeni'
            ? <Link className="b-btn b-btn--secondario" href="/admin/menu">Mostra tutti</Link>
            : <Link className="b-btn b-btn--secondario" href="/admin/menu?filtro=allergeni">Mostra solo questi</Link>}
        </div>
      )}
      <nav aria-label="Filtra i piatti" className="b-schede">
        {scheda(undefined, 'Tutti')}{scheda('allergeni', 'Allergeni da confermare', daConfermare)}{scheda('esauriti', 'Esauriti', esauriti)}
      </nav>
      <ElencoPiatti categorie={categorie} cambia={cambiaDisponibilita} cambiaReparto={cambiaRepartoCategoria} />
    </>
  )
}
