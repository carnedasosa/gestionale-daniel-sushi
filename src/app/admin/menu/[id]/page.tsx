import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { leggiPiatto } from '@/menu/repo'
import { formatEuro } from '@/domain/soldi'
import { ModuloPiatto } from './ModuloPiatto'

export default async function ModificaPiatto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const piatto = await leggiPiatto(db, id)
  if (!piatto) notFound()
  return (
    <>
      <Link className="ds-link" href="/admin/menu">← Torna al menù</Link>
      <h1 className="heading">{piatto.numero ? `${piatto.numero}. ` : ''}{piatto.nome}</h1>
      <ModuloPiatto
        id={piatto.id}
        valori={{
          nome: piatto.nome,
          descrizione: piatto.descrizione ?? '',
          prezzo: formatEuro(piatto.prezzoCent).replace(' €', ''),
          piccante: piatto.piccante,
          vegetariano: piatto.vegetariano,
          dellaCasa: piatto.dellaCasa,
          allergeni: piatto.allergeni,
          allergeniConfermati: piatto.allergeniConfermati,
        }}
      />
    </>
  )
}
