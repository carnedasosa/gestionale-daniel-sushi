import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { ModuloPoke } from './ModuloPoke'
import { ModuloAllergeniPoke } from './ModuloAllergeniPoke'
export default async function PokeAdmin() {
  await richiediRuolo('admin')
  const config = await leggiPokeConfig(db)
  const allergeni = config ? await leggiAllergeniPoke(db,config) : null
  return <><h1 className="heading">Regole della poke</h1><p>Imposta quantità incluse, limiti e prezzi. Gli ingredienti sono quelli del menù.</p>
    {config && allergeni ? <>
      <ModuloPoke config={config} />
      <h2 className="heading">Allergeni degli ingredienti</h2>
      {!allergeni.confermati && <p className="admin-avviso">Finché non confermi gli allergeni di tutti gli ingredienti, la poke composta non si può ordinare da casa. Al tavolo resta ordinabile.</p>}
      <ModuloAllergeniPoke config={config} allergeni={allergeni} />
    </> : <p>Configurazione della poke non trovata: importa prima il menù.</p>}</>
}
