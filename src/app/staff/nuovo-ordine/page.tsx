import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { leggiPokeConfig } from '@/tavoli/poke-repo'
import { leggiDisponibilita } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { SERVIZI } from '@/domain/fasce'
import { pokeOrdinabile } from '@/domain/poke'
import { BarraStaff } from '../BarraStaff'
import { NuovoOrdineCassa, type DisponibilitaCassa } from './NuovoOrdineCassa'
import '@/styles/banco/menu.css'
import '@/app/(cliente)/casa.css'
import '../staff.css'

/** Ordine preso a voce dalla cassa (telefono o WhatsApp): stesso menù del sito, dati del cliente ridotti, in cucina già accettato. */
export default async function PaginaNuovoOrdine() {
  await richiediRuolo('staff')
  const [categorie,config,d] = await Promise.all([leggiMenu(db),leggiPokeConfig(db),leggiDisponibilita(db,new Date(),modalitaProva(process.env),'cassa')])
  const disponibilita: DisponibilitaCassa = {
    zone: d.zone,occupazione: d.occupazione,regole: d.regole,
    servizi: Object.fromEntries(SERVIZI.map(s => { const a = d.servizi[s].apertura
      return [s,{ aperto: a.aperto,motivo: a.aperto ? null : TESTO_MOTIVO[a.motivo],forzabile: a.aperto || a.motivo === 'fasce',fasce: d.servizi[s].fasce,future: d.servizi[s].future }] })) as DisponibilitaCassa['servizi'],
  }
  return <main className="b-staff">
    <BarraStaff daGuardare={0} online={null} ora={new Date().toISOString()} />
    <div className="b-staff__vista b-nuovo-ordine b-con-barra">
      <header className="b-nuovo-ordine__testa">
        <Link href="/staff" className="b-btn b-btn--secondario">← Schermo staff</Link>
        <h1 className="b-titolo-1">Nuovo ordine dalla cassa</h1>
        <p className="b-secondario">Per telefono o WhatsApp: scegli i piatti, poi «Dati del cliente». L’ordine occupa l’orario come quelli del sito e va in cucina già accettato.</p>
      </header>
      <NuovoOrdineCassa categorie={categorie} poke={config && pokeOrdinabile(config) ? config : null} disponibilita={disponibilita} />
    </div>
  </main>
}
