import Image from 'next/image'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { tavoloDaSlug, sessioneApertaPerId } from '@/tavoli/repo'
import { nomeCookieTavolo } from '@/tavoli/cookie'
import { ModuloCodice } from './ModuloCodice'
import { leggiMenu } from '@/menu/repo'
import { leggiPokeConfig } from '@/tavoli/poke-repo'
import { ordiniDellaSessione } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { MenuOrdinabile } from './MenuOrdinabile'
import { OrdinatoFinora } from './OrdinatoFinora'
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
  const dati = autorizzata && sessione ? await Promise.all([leggiMenu(db),leggiPokeConfig(db),ordiniDellaSessione(db,sessione.id)]) : null
  return <main className="contenitore tavolo-pagina">
    <header className="intestazione"><Image src="/logo.png" alt="Daniel's Sushi" width={64} height={64} priority /><h1 className="heading">{tavolo.nome}</h1></header>
    <AggiornamentoAutomatico ogniSecondi={10} />
    {dati && sessione ? <><MenuOrdinabile key={sessione.id} categorie={dati[0]} config={dati[1]} sessioneId={sessione.id} slug={slug} /><OrdinatoFinora ordini={dati[2].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))} /></> : <>
      {id && !sessione && <p role="status">Il tavolo è chiuso, grazie per essere stati da noi!</p>}
      <ModuloCodice slug={slug} />
    </>}
  </main>
}
