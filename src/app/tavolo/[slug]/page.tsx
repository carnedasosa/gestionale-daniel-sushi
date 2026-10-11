import Image from 'next/image'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { tavoloDaSlug, sessioneApertaPerId } from '@/tavoli/repo'
import { nomeCookieTavolo } from '@/tavoli/cookie'
import { ModuloCodice } from './ModuloCodice'
import '@/styles/menu.css'
import './tavolo.css'

export default async function TavoloPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const jar = await cookies()
  const tavolo = await tavoloDaSlug(db,slug)
  if (!tavolo) notFound()
  const id = jar.get(nomeCookieTavolo(slug))?.value
  const sessione = id ? await sessioneApertaPerId(db,id) : null
  const autorizzata = sessione?.tavoloId === tavolo.id
  return <main className="contenitore tavolo-pagina">
    <header className="intestazione"><Image src="/logo.png" alt="Daniel's Sushi" width={64} height={64} priority /><h1 className="heading">{tavolo.nome}</h1></header>
    {autorizzata ? <p>Sei al tavolo {tavolo.nome}</p> : <>
      {id && !sessione && <p role="status">Il tavolo è chiuso, grazie per essere stati da noi!</p>}
      <ModuloCodice slug={slug} />
    </>}
  </main>
}
