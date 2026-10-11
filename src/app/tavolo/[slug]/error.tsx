'use client'
import { useEffect } from 'react'
export default function ErroreTavolo({ error,retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error.digest ?? 'Errore nella pagina del tavolo') },[error])
  return <main className="contenitore"><h1 className="heading">Qualcosa è andato storto</h1><p>Non è stato possibile caricare il tavolo. Riprova tra qualche istante oppure chiedi al personale.</p><button type="button" className="ds-btn ds-btn--primary" onClick={retry}>Riprova</button></main>
}
