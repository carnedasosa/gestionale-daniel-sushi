import { ModuloAccesso } from './ModuloAccesso'
import './accesso.css'

export default async function PaginaAccesso({ searchParams }: { searchParams: Promise<{ next?: string; errore?: string }> }) {
  const { next = '', errore } = await searchParams
  return (
    <main className="b-accesso">
      <div className="b-accesso__dentro">
        <div className="b-accesso__testa">
          <span className="b-num b-accesso__marchio">Daniel&apos;s Sushi</span>
          <h1 className="b-accesso__titolo">Gestionale</h1>
          <p>Accesso per lo staff e per l’admin.</p>
        </div>
        <ModuloAccesso next={next} erroreIniziale={errore === 'permessi' ? 'Non hai i permessi per quella sezione.' : null} />
        <p className="b-accesso__nota">Dopo l’accesso lo staff va allo schermo degli ordini, Daniel all’area admin.</p>
      </div>
    </main>
  )
}
