import Link from 'next/link'
import { notFound } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiMenu, leggiPiatto } from '@/menu/repo'
import { formatEuro } from '@/domain/soldi'
import { ModuloPiatto } from './ModuloPiatto'
import { FotoPiatto } from '../FotoPiatto'

export default async function ModificaPiatto({ params }: { params: Promise<{ id: string }> }) {
  await richiediRuolo('admin')
  const { id } = await params
  const piatto = await leggiPiatto(db, id)
  if (!piatto) notFound()
  const categoria = (await leggiMenu(db)).find((c) => c.id === piatto.categoriaId)
  return (
    <>
      <Link className="b-btn b-btn--discreto" href="/admin/menu" style={{ alignSelf: 'flex-start' }}>← Menù{categoria ? ` · ${categoria.nome}` : ''}</Link>
      <div className="b-admin-testa"><h1 className="b-titolo-1">{piatto.numero !== null && <span className="b-num b-secondario">{piatto.numero} </span>}{piatto.nome}</h1>
        <span className={`b-stato ${piatto.allergeniConfermati ? 'b-stato--pronto' : 'b-stato--accettare'}`}>{piatto.allergeniConfermati ? 'Allergeni confermati' : 'Allergeni da confermare'}</span></div>
      <FotoPiatto id={piatto.id} nome={piatto.nome} foto={piatto.foto} />
      <ModuloPiatto
        id={piatto.id}
        vino={categoria?.tipo === 'vini'}
        valori={{
          nome: piatto.nome,
          descrizione: piatto.descrizione ?? '',
          prezzo: formatEuro(piatto.prezzoCent).replace('\u00a0€', ''),
          piccante: piatto.piccante,
          vegetariano: piatto.vegetariano,
          dellaCasa: piatto.dellaCasa,
          allergeni: piatto.allergeni,
          allergeniConfermati: piatto.allergeniConfermati,
          vinoTipologia: piatto.vino?.tipologia ?? '',
          vinoFormato: piatto.vino?.formato ?? 'bottiglia',
          vinoCantina: piatto.vino?.cantina ?? '',
          vinoDenominazione: piatto.vino?.denominazione ?? '',
          vinoAnnata: piatto.vino?.annata ? String(piatto.vino.annata) : '',
        }}
      />
    </>
  )
}
