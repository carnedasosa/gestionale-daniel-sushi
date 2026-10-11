import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiPokeConfig } from '@/tavoli/poke-repo'
import { ModuloPoke } from './ModuloPoke'
export default async function PokeAdmin() {
  await richiediRuolo('admin')
  const config = await leggiPokeConfig(db)
  return <><h1 className="heading">Regole della poke</h1><p>Imposta quantità incluse, limiti e prezzi. Gli ingredienti sono quelli del menù.</p>
    {config ? <ModuloPoke config={config} /> : <p>Configurazione della poke non trovata: importa prima il menù.</p>}</>
}
