import Link from 'next/link'

export default function NonTrovata() {
  return (
    <main className="contenitore non-trovata">
      <h1 className="display">Pagina non trovata</h1>
      <p>La pagina che cerchi non esiste o è stata spostata.</p>
      <Link href="/" className="ds-btn ds-btn--primary">Vai al menù</Link>
    </main>
  )
}
