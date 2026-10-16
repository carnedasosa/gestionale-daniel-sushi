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
import { MenuTavolo } from './MenuTavolo'
import { OrdinatoFinora } from '@/ordinare/OrdinatoFinora'
import '@/styles/banco/menu.css'
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
  if (!dati || !sessione) return <main className="b-contenitore b-tavolo b-tavolo--fuori">
    <div className="b-tavolo__logo"><Image src="/logo.png" alt="Daniel's Sushi" width={48} height={48} priority /><span>Daniel&apos;s Sushi</span></div>
    <div className="b-tavolo__benvenuto"><p className="b-num b-secondario">Benvenuti al</p><h1 className="b-tavolo__nome">{tavolo.nome}</h1></div>
    <ModuloCodice chiave={chiave} pulisci={accesso.pulisci} chiuso={accesso.chiuso} tavoloAperto={tavoloAperto} />
  </main>
  const ordini = dati[2].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))
  return <main className="b-contenitore b-tavolo b-con-barra">
    <header className="b-tavolo__testa">
      <div className="b-tavolo__logo"><Image src="/logo.png" alt="Daniel's Sushi" width={40} height={40} priority /><h1 className="b-titolo-2">{tavolo.nome}</h1></div>
      <nav aria-label="Sezioni del tavolo" className="b-schede b-tavolo__schede"><a className="b-scheda" href="#menu">Menù</a><a className="b-scheda" href="#ordinato">Ordinato <span className="b-badge">{ordini.length}</span></a></nav>
    </header>
    <AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={new Date().toISOString()} />
    <div id="menu" className="b-tavolo__menu"><MenuTavolo key={sessione.id} categorie={dati[0]} config={dati[1]} sessioneId={sessione.id} chiave={chiave} /></div>
    <OrdinatoFinora ordini={ordini} />
  </main>
}
