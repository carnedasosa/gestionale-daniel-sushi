import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { ModuloPiatto } from '../[id]/ModuloPiatto'

// `?categoria=vini` apre il modulo già sulla carta dei vini, con «solfiti» tra gli allergeni.
export default async function NuovoPiatto({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  await richiediRuolo('admin')
  const { categoria } = await searchParams
  const menu = await leggiMenu(db)
  const scelta = menu.find((c) => c.id === categoria)
  return (
    <>
      <Link className="b-btn b-btn--discreto" href="/admin/menu" style={{ alignSelf: 'flex-start' }}>← Menù</Link>
      <div className="b-admin-testa"><h1 className="b-titolo-1">{scelta?.tipo === 'vini' ? 'Nuovo vino' : 'Nuovo piatto'}</h1></div>
      <ModuloPiatto
        id={null}
        nuovo={{ categorie: menu.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })), categoriaId: scelta?.id ?? '', numero: '' }}
        valori={{ nome: '', descrizione: '', prezzo: '', piccante: false, vegetariano: false, dellaCasa: false,
          allergeni: scelta?.tipo === 'vini' ? ['solfiti'] : [], allergeniConfermati: false, vinoTipologia: '', vinoFormato: 'bottiglia', vinoCantina: '', vinoDenominazione: '', vinoAnnata: '' }}
      />
    </>
  )
}
