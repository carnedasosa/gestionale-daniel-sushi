import Link from 'next/link'
import { redirect } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { leggiPokeConfig } from '@/tavoli/poke-repo'
import { sessioneApertaPerId } from '@/tavoli/repo'
import { ordiniDellaSessione } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { OrdinatoFinora } from '@/ordinare/OrdinatoFinora'
import { BarraStaff } from '../../../BarraStaff'
import { MenuCameriere } from './MenuCameriere'
import '@/styles/banco/menu.css'
import '@/app/tavolo/[chiave]/tavolo.css'
import '../../../staff.css'

/** Comanda del cameriere: dal proprio telefono ordina per un tavolo aperto, senza passare dal codice del cliente. */
export default async function OrdinaPerIlTavoloPage({ params }: { params: Promise<{ sessione: string }> }) {
  await richiediRuolo('staff')
  const { sessione: id } = await params
  const sessione = await sessioneApertaPerId(db,id)
  // Tavolo chiuso o inesistente: si torna alla piantina, dove si vede cosa è aperto.
  if (!sessione) redirect('/staff?vista=tavoli')
  const [categorie,config,ordini] = await Promise.all([leggiMenu(db),leggiPokeConfig(db),ordiniDellaSessione(db,sessione.id)])
  return <main className="b-staff b-con-barra">
    <BarraStaff vista="tavoli" daGuardare={0} online={null} ora={new Date().toISOString()} />
    <div className="b-staff__vista b-ordina-tavolo">
      <header className="b-ordina-tavolo__testa">
        <Link href="/staff?vista=tavoli" className="b-btn b-btn--secondario">← Tavoli</Link>
        <h1 className="b-titolo-1">Ordine per {sessione.tavoloNome}</h1>
        <p className="b-ordina-tavolo__codice"><span className="b-secondario b-piccolo">codice</span><span className="b-num" aria-label={`Codice ${sessione.codice}`}>{sessione.codice}</span></p>
        <p className="b-secondario">La comanda va in cucina come quelle dei telefoni del tavolo e finisce nello stesso conto.</p>
      </header>
      <AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={new Date().toISOString()} />
      <div id="menu" className="b-tavolo__menu"><MenuCameriere key={sessione.id} categorie={categorie} config={config} sessioneId={sessione.id} /></div>
      <OrdinatoFinora ordini={ordini.map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))} vista="staff" />
    </div>
  </main>
}
