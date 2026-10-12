'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import type { RigaCarrello } from '@/domain/carrello'
import { Pannello } from '@/componenti/Pannello'
export interface RigaVista extends RigaCarrello { nome: string; prezzoCent: number; daRicomporre?: boolean }
export function Carrello({ righe,modifica,nota,invia,inCorso,errore }: { righe: RigaVista[]; modifica: (i: number,q: number) => void; nota: (i: number,testo: string) => void; invia: () => Promise<boolean>; inCorso: boolean; errore: string | null }) {
  const [aperto,setAperto] = useState(false)
  const totale = righe.reduce((s,r) => s + r.prezzoCent * r.quantita,0)
  const quantita = righe.reduce((s,r) => s + r.quantita,0)
  return <>
    <div className="tavolo-carrello-barra"><button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAperto(true)}>Carrello · {quantita} piatti · {formatEuro(totale)} stimati</button></div>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Il tuo carrello">
      {!righe.length && <p>Il carrello è vuoto. Scegli i piatti dal menù.</p>}
      {righe.map((r,i) => <div key={`${r.piattoId}-${i}`} className="tavolo-carrello-riga">
        <h3>{r.nome} · {r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</h3>
        {r.daRicomporre && <p role="alert">Questa poke va ricomposta: rimuovila e aggiungila di nuovo.</p>}
        {r.poke && <p>{Object.entries(r.poke).filter(([,v]) => v.length).map(([g,v]) => `${g}: ${v.join(', ')}`).join(' · ')}</p>}
        <div className="tavolo-quantita"><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Riduci ${r.nome}`} aria-busy={inCorso} disabled={inCorso} onClick={() => modifica(i,r.quantita-1)}>−</button><span>{r.quantita}</span><button type="button" className="ds-btn ds-btn--secondary" aria-label={`Aumenta ${r.nome}`} aria-busy={inCorso} disabled={inCorso || r.quantita >= 20} onClick={() => modifica(i,r.quantita+1)}>+</button>
          <button type="button" className="ds-btn ds-btn--secondary" aria-busy={inCorso} disabled={inCorso} onClick={() => modifica(i,0)}>Rimuovi</button></div>
        <label className="campo">Note per la cucina, es. senza sesamo<textarea maxLength={200} value={r.nota} disabled={inCorso} onChange={e => nota(i,e.target.value)} rows={2} /></label>
      </div>)}
      <p>Totale stimato: <strong>{formatEuro(totale)}</strong>{righe.some(r => r.daRicomporre) && ' (senza le poke da ricomporre)'}. Il prezzo viene verificato all’invio.</p>
      {errore && <p role="alert">{errore}</p>}
      <button type="button" className="ds-btn ds-btn--primary" aria-busy={inCorso} disabled={inCorso || !righe.length || righe.some(r => r.daRicomporre)} onClick={async () => { if (await invia()) setAperto(false) }}>{inCorso ? 'Invio in corso…' : 'Invia ordine'}</button>
    </Pannello>
  </>
}
