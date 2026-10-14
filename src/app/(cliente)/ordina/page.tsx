import Link from 'next/link'
import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { SERVIZI } from '@/domain/fasce'
import { Checkout, type DisponibilitaCheckout } from './Checkout'
import '../casa.css'
export default async function PaginaOrdina() {
  await connection()
  const categorie = await leggiMenu(db)
  const d = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const poke = await leggiPokeDaCasa(db)
  const disponibilita: DisponibilitaCheckout = {
    zone: d.zone,
    servizi: Object.fromEntries(SERVIZI.map(s => { const a = d.servizi[s].apertura; return [s,{ aperto: a.aperto,motivo: a.aperto ? null : TESTO_MOTIVO[a.motivo],fasce: d.servizi[s].fasce,piene: d.servizi[s].piene }] })) as DisponibilitaCheckout['servizi'],
  }
  return <main className="b-contenitore b-pagina-cliente b-con-barra">
    <p><Link className="b-btn b-btn--secondario" href="/">← Menù</Link></p>
    <div className="b-checkout__intro"><h1 className="b-titolo-1">Quasi fatto</h1><p className="b-secondario">Poche domande e l’ordine parte. Paghi quando lo ricevi.</p></div>
    <Checkout piatti={categorie.flatMap(c => c.piatti)} poke={poke?.config ?? null} disponibilita={disponibilita} />
  </main>
}
