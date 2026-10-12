import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { SERVIZI } from '@/domain/fasce'
import { Checkout, type DisponibilitaCheckout } from './Checkout'
import '@/app/tavolo/[chiave]/tavolo.css'
import '../casa.css'
export default async function PaginaOrdina() {
  await connection()
  const categorie = await leggiMenu(db)
  const d = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const poke = await leggiPokeDaCasa(db)
  const disponibilita: DisponibilitaCheckout = {
    zone: d.zone,
    servizi: Object.fromEntries(SERVIZI.map(s => { const a = d.servizi[s].apertura; return [s,{ aperto: a.aperto,motivo: a.aperto ? null : TESTO_MOTIVO[a.motivo],fasce: d.servizi[s].fasce }] })) as DisponibilitaCheckout['servizi'],
  }
  return <main className="contenitore casa-pagina">
    <h1 className="heading">Il tuo ordine</h1>
    <Checkout piatti={categorie.flatMap(c => c.piatti)} poke={poke?.config ?? null} disponibilita={disponibilita} />
  </main>
}
