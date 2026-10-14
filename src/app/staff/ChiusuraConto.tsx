'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { ChiudiTavolo } from './ChiudiTavolo'

export interface RiferimentoConto { vistoAlle: string; ordiniIds: string[]; totaleCent: number }

export function AvvisoContoCambiato({ base,attuale,ricontrollato }: { base: RiferimentoConto; attuale: RiferimentoConto; ricontrollato: () => void }) {
  const n = attuale.ordiniIds.filter(id => !base.ordiniIds.includes(id)).length
  if (!n) return null
  return <div role="status" className="b-avviso b-avviso--accettare">
    <p>{n === 1 ? 'È arrivato 1 nuovo ordine' : `Sono arrivati ${n} nuovi ordini`} da quando hai aperto il conto: il totale è passato da {formatEuro(base.totaleCent)} a {formatEuro(attuale.totaleCent)}. Ricontrolla prima di battere in cassa.</p>
    <button type="button" className="b-btn b-btn--secondario" onClick={ricontrollato}>Ho ricontrollato il conto</button>
  </div>
}

// Il riferimento è il conto che il cameriere aveva davanti quando ha aperto la pagina.
// L'aggiornamento automatico ogni 10 secondi non lo sposta: gli ordini arrivati nel frattempo
// restano segnalati qui e fanno scattare la conferma alla chiusura.
export function ChiusuraConto({ sessioneId,attuale }: { sessioneId: string; attuale: RiferimentoConto }) {
  const [base,setBase] = useState(attuale)
  return <div className="b-conto__chiusura">
    <AvvisoContoCambiato base={base} attuale={attuale} ricontrollato={() => setBase(attuale)} />
    <ChiudiTavolo sessioneId={sessioneId} contoVistoAlle={base.vistoAlle} primaria />
  </div>
}
