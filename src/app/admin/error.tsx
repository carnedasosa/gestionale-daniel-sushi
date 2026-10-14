'use client'

import Link from 'next/link'
import { useEffect } from 'react'

// Il messaggio dell'errore non va mostrato: in produzione è generico e in sviluppo può rivelare dettagli.
export default function ErroreAdmin({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? 'Errore nell’area admin')
  }, [error])

  return (
    <>
      <h1 className="b-titolo-1">Qualcosa è andato storto</h1>
      <p className="b-secondario">Non è stato possibile caricare questa pagina. Riprova tra qualche istante.</p>
      <div>
        <button type="button" className="b-btn b-btn--principale" onClick={() => retry()}>Riprova</button>
      </div>
      <Link className="b-btn b-btn--discreto" href="/admin/menu">Torna al menù</Link>
    </>
  )
}
