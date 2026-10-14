'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { formatEuro } from '@/domain/soldi'
import type { Conto } from '@/tavoli/ordini-repo'
import { annullaVoceStaff } from './azioni'
export function VoceConto({ sessioneId,voce: v }: { sessioneId: string; voce: Conto['voci'][number] }) {
  const [inCorso,startTransition] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const router = useRouter()
  return <tr><td className="b-num b-secondario">{v.numero ?? '—'}</td><td><span className="b-conto__piatto">{v.nome}</span>
    {v.poke && <div className="b-conto__poke">{Object.entries(v.poke).filter(([,scelte]) => scelte.length).map(([nome,scelte]) => <p key={nome}>{nome}: {scelte.join(', ')}</p>)}</div>}
    <ConfermaAzione stile="discreto" inCorso={inCorso} domanda={`Annullare tutte le ${v.quantita} porzioni di questa voce (${v.nome})?`} conferma={() => startTransition(async () => {
      setErrore(null)
      try { const e = await annullaVoceStaff(sessioneId,v); if (!e.ok) setErrore(e.errore ?? 'Annullamento non riuscito.'); router.refresh() }
      catch { setErrore('Annullamento non riuscito, riprova.') }
    })}>Annulla</ConfermaAzione>{errore && <p role="alert" className="b-errore">{errore}</p>}
  </td><td className="b-num b-destra">{v.quantita}</td><td className="b-num b-destra">{formatEuro(v.importoCent)}</td></tr>
}
