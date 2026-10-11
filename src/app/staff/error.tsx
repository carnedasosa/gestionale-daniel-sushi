'use client'
import Link from 'next/link'
import { useEffect } from 'react'
export default function ErroreStaff({ error,retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error.digest ?? 'Errore nell’area staff') },[error])
  return <main className="contenitore"><h1 className="heading">Qualcosa è andato storto</h1><p>Non è stato possibile caricare lo schermo. Riprova tra qualche istante.</p><button type="button" className="ds-btn ds-btn--primary" onClick={retry}>Riprova</button><p><Link className="ds-link" href="/staff">Torna allo schermo staff</Link></p></main>
}
