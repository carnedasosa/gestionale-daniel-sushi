import Image from 'next/image'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { tavoloDaChiave, sessionePerId, sessioneDelTavolo } from '@/tavoli/repo'
import { valutaAccesso } from '@/domain/accesso-tavolo'
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

export default async function TavoloPage({ params }: { params: Promise<{ chiave: string }> }) {
  const { chiave } = await params
  const jar = await cookies()
  const tavolo = await tavoloDaChiave(db,chiave)
  if (!tavolo) notFound()
  const id = jar.get(nomeCookieTavolo(chiave))?.value
  const sessione = id ? await sessionePerId(db,id) : null
  const accesso = valutaAccesso(tavolo.id,!!id,sessione)
  const autorizzata = accesso.autorizzata
  const dati = autorizzata && sessione ? await Promise.all([leggiMenu(db),leggiPokeConfig(db),ordiniDellaSessione(db,sessione.id)]) : null
  // Il saluto «tavolo chiuso» non va mostrato se nel frattempo il tavolo è stato riaperto.
  const tavoloAperto = !autorizzata && !!await sessioneDelTavolo(db,tavolo.id)
  return <main className="contenitore tavolo-pagina">
    <header className="intestazione"><Image src="/logo.png" alt="Daniel's Sushi" width={64} height={64} priority /><h1 className="heading">{tavolo.nome}</h1></header>
    <AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={new Date().toISOString()} />
    {dati && sessione ? <><MenuOrdinabile key={sessione.id} categorie={dati[0]} config={dati[1]} sessioneId={sessione.id} chiave={chiave} /><OrdinatoFinora ordini={dati[2].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))} /></> : <>
      <ModuloCodice chiave={chiave} pulisci={accesso.pulisci} chiuso={accesso.chiuso} tavoloAperto={tavoloAperto} />
    </>}
  </main>
}
