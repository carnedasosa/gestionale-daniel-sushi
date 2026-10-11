import { connection } from 'next/server'
import { db } from '@/server/db'
import { leggiMenu } from '@/menu/repo'
import { MenuCliente } from '@/menu/componenti/MenuCliente'

export default async function Home() {
  await connection() // sempre dal database: prezzi e disponibilità cambiano durante il servizio
  const categorie = await leggiMenu(db)
  return (
    <main className="contenitore">
      <h1 className="display">Il menù</h1>
      <MenuCliente categorie={categorie} />
    </main>
  )
}
