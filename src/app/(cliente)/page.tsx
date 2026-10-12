import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { MenuCliente } from '@/menu/componenti/MenuCliente'
import { leggiDisponibilita, leggiPokeDaCasa } from '@/casa/disponibilita'
import { modalitaProva, TESTO_MOTIVO } from '@/domain/apertura-casa'
import { MenuCasa } from './MenuCasa'
import { OrdineInCorso } from './OrdineInCorso'
import '@/app/tavolo/[chiave]/tavolo.css'
import './casa.css'

export default async function Home() {
  await connection() // sempre dal database: prezzi e disponibilità cambiano durante il servizio
  const categorie = await leggiMenu(db)
  const disponibilita = await leggiDisponibilita(db,new Date(),modalitaProva(process.env))
  const { asporto,domicilio } = disponibilita.servizi
  const aperto = asporto.apertura.aperto || domicilio.apertura.aperto
  const poke = aperto ? await leggiPokeDaCasa(db) : null
  return (
    <main className={aperto ? 'contenitore tavolo-pagina' : 'contenitore'}>
      <h1 className="display">Il menù</h1>
      <OrdineInCorso />
      {aperto ? <MenuCasa categorie={categorie} poke={poke} /> : <>
        <p className="casa-avviso" role="status">{!asporto.apertura.aperto && TESTO_MOTIVO[asporto.apertura.motivo]} Il menù resta consultabile.</p>
        <MenuCliente categorie={categorie} />
      </>}
    </main>
  )
}
