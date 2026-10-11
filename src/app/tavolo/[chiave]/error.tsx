'use client'
import { useEffect } from 'react'
import { RiprovaAutomatico } from '@/componenti/RiprovaAutomatico'
export default function ErroreTavolo({ error,retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error.digest ?? 'Errore nella pagina del tavolo') },[error])
  return <main className="contenitore"><h1 className="heading">Qualcosa è andato storto</h1><p>Non è stato possibile caricare il tavolo. Riprovo automaticamente; puoi anche chiedere al personale.</p><RiprovaAutomatico retry={retry} /></main>
}
