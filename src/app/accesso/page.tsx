import Image from 'next/image'
import { ModuloAccesso } from './ModuloAccesso'
import './accesso.css'

export default async function PaginaAccesso({ searchParams }: { searchParams: Promise<{ next?: string; errore?: string }> }) {
  const { next = '', errore } = await searchParams
  return (
    <main className="contenitore accesso-pagina">
      <Image src="/logo.png" alt="Daniel's Sushi" width={120} height={120} priority />
      <h1 className="heading">Gestionale</h1>
      <ModuloAccesso next={next} erroreIniziale={errore === 'permessi' ? 'Non hai i permessi per quella sezione.' : null} />
    </main>
  )
}
