import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { ModuloPoke } from './ModuloPoke'
import { ModuloAllergeniPoke } from './ModuloAllergeniPoke'
export default async function PokeAdmin() {
  await richiediRuolo('admin')
  const config = await leggiPokeConfig(db)
  const allergeni = config ? await leggiAllergeniPoke(db,config) : null
  return <>
    <div className="b-admin-testa"><div className="b-admin-testa__testi"><h1 className="b-titolo-1">Poke da comporre</h1><p className="b-secondario">Prezzi e regole della poke che il cliente compone da sé. Gli ingredienti sono quelli del menù.</p></div></div>
    {config && allergeni ? <>
      <nav aria-label="Sezioni della poke" className="b-schede"><a className="b-scheda" href="#regole">Prezzi e regole</a><a className="b-scheda" href="#allergeni">Allergeni degli ingredienti{!allergeni.confermati && <span className="b-punto b-punto--accettare" aria-label="da confermare" />}</a></nav>
      <ModuloPoke config={config} />
      <section id="allergeni" className="b-admin-sezione" aria-labelledby="titolo-allergeni">
        <div className="b-admin-sezione__testa"><h2 id="titolo-allergeni" className="b-titolo-2">Allergeni degli ingredienti</h2>
          <span className={`b-stato ${allergeni.confermati ? 'b-stato--pronto' : 'b-stato--accettare'}`}>{allergeni.confermati ? 'Confermati' : 'Da confermare'}</span></div>
        {!allergeni.confermati && <p className="b-avviso b-avviso--accettare">Finché non confermi gli allergeni di tutti gli ingredienti, la poke composta non si può ordinare da casa. Al tavolo resta ordinabile.</p>}
        <ModuloAllergeniPoke config={config} allergeni={allergeni} />
      </section>
    </> : <p className="b-avviso">Configurazione della poke non trovata: importa prima il menù.</p>}
  </>
}
