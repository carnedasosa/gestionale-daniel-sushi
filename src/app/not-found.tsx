import Link from 'next/link'

export default function NonTrovata() {
  return (
    <main className="b-contenitore b-servizio">
      <h1 className="b-titolo-1">Pagina non trovata</h1>
      <p className="b-secondario">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link href="/" className="b-btn b-btn--principale">Vai al menù</Link>
    </main>
  )
}
