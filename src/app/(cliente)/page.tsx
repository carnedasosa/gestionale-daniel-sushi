import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { MenuCliente } from '@/menu/componenti/MenuCliente'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { oraRoma } from '@/domain/ora-roma'
import { MenuCasa } from './MenuCasa'
import { OrdineInCorso } from './OrdineInCorso'

export default async function Home() {
  await connection() // sempre dal database: prezzi e disponibilità cambiano durante il servizio
  const categorie = await leggiMenu(db)
  const disponibilita = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const { asporto,domicilio } = disponibilita.servizi
  const aperto = asporto.apertura.aperto || domicilio.apertura.aperto
  const poke = aperto ? await leggiPokeDaCasa(db) : null
  const dalle = (fasce: string[]) => fasce.length ? oraRoma(new Date(fasce[0])) : null
  const orari = [asporto.apertura.aperto && dalle(asporto.fasce) && `Ritiro dalle ${dalle(asporto.fasce)}`,domicilio.apertura.aperto && dalle(domicilio.fasce) && `consegna dalle ${dalle(domicilio.fasce)}`].filter(Boolean).join(' · ')
  return (
    <main className={aperto ? 'b-contenitore b-pagina-cliente b-con-barra' : 'b-contenitore b-pagina-cliente'}>
      <OrdineInCorso />
      {aperto ? <div className="b-aperti" role="status"><span className="b-punto b-punto--pronto" aria-hidden="true" />
        <div><p className="b-aperti__titolo">Ordini aperti stasera</p>{orari && <p className="b-secondario">{orari.charAt(0).toUpperCase() + orari.slice(1)}</p>}</div></div>
        : <p className="b-avviso b-avviso--accettare" role="status">{!asporto.apertura.aperto && TESTO_MOTIVO[asporto.apertura.motivo]} Il menù resta consultabile.</p>}
      <h1 className="b-titolo-1">Il menù</h1>
      {aperto ? <MenuCasa categorie={categorie} poke={poke} /> : <MenuCliente categorie={categorie} />}
    </main>
  )
}
