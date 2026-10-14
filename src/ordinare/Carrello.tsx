'use client'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { Pannello } from '@/componenti/Pannello'
import type { RigaVista } from './vista-carrello'
import { BarraBasso } from '@/componenti/BarraBasso'

function RigaCarrello({ r,i,modifica,nota,inCorso }: { r: RigaVista; i: number; modifica: (i: number,q: number) => void; nota: (i: number,testo: string) => void; inCorso: boolean }) {
  const [notaAperta,setNotaAperta] = useState(!!r.nota)
  return <div className="b-carrello__riga">
    <h3 className="b-carrello__nome"><span>{r.nome}</span><span className="b-num">{r.daRicomporre ? '—' : formatEuro(r.prezzoCent * r.quantita)}</span></h3>
    {r.daRicomporre && <p role="alert" className="b-errore">Questa poke va ricomposta: rimuovila e aggiungila di nuovo.</p>}
    {r.poke && <p className="b-secondario b-piccolo">{Object.entries(r.poke).filter(([,v]) => v.length).map(([g,v]) => `${g}: ${v.join(', ')}`).join(' · ')}</p>}
    {notaAperta && <label className="b-campo">Nota per la cucina, es. senza sesamo<textarea maxLength={200} value={r.nota} disabled={inCorso} onChange={e => nota(i,e.target.value)} rows={2} /></label>}
    <div className="b-azioni">
      <div className="b-quantita b-quantita--chiara" role="group" aria-label={`Quantità di ${r.nome}`}>
        <button type="button" className="b-quantita__btn" aria-label={`Riduci ${r.nome}`} aria-busy={inCorso} disabled={inCorso} onClick={() => modifica(i,r.quantita - 1)}>−</button>
        <span className="b-num">{r.quantita}</span>
        <button type="button" className="b-quantita__btn" aria-label={`Aumenta ${r.nome}`} aria-busy={inCorso} disabled={inCorso || r.quantita >= 20} onClick={() => modifica(i,r.quantita + 1)}>+</button>
      </div>
      {!notaAperta && <button type="button" className="b-btn b-btn--discreto" onClick={() => setNotaAperta(true)}>Nota per la cucina<span className="b-nascosto"> per {r.nome}</span></button>}
      <button type="button" className="b-btn b-btn--discreto b-btn--pericolo" aria-busy={inCorso} disabled={inCorso} onClick={() => modifica(i,0)}>Rimuovi<span className="b-nascosto"> {r.nome}</span></button>
    </div>
  </div>
}

// `azione`: testo del bottone pieno (al tavolo invia, da casa porta al riepilogo). `etichettaBarra`: testo della barra in basso.
export function Carrello({ righe,modifica,nota,invia,inCorso,errore,azione = 'Invia ordine',etichettaBarra = 'Vedi il carrello' }: { righe: RigaVista[]; modifica: (i: number,q: number) => void; nota: (i: number,testo: string) => void; invia: () => Promise<boolean>; inCorso: boolean; errore: string | null; azione?: string; etichettaBarra?: string }) {
  const [aperto,setAperto] = useState(false)
  const totale = righe.reduce((s,r) => s + r.prezzoCent * r.quantita,0)
  const quantita = righe.reduce((s,r) => s + r.quantita,0)
  return <>
    <BarraBasso>
      <button type="button" className="b-btn b-btn--principale b-btn--barra" aria-label={`${etichettaBarra} · ${quantita} piatti · ${formatEuro(totale)}`} onClick={() => setAperto(true)}>
        <span className="b-badge" aria-hidden="true">{quantita}</span><span className="b-barra-basso__testo">{etichettaBarra}</span><span className="b-num">{formatEuro(totale)}</span>
      </button>
    </BarraBasso>
    <Pannello aperto={aperto} chiudi={() => setAperto(false)} titolo="Il tuo carrello">
      {!righe.length ? <p>Il carrello è vuoto. Scegli i piatti dal menù.</p> : <div className="b-lista">{righe.map((r,i) => <RigaCarrello key={`${r.piattoId}-${i}`} r={r} i={i} modifica={modifica} nota={nota} inCorso={inCorso} />)}</div>}
      <div className="b-scontrino__totale"><span>Totale stimato</span><span className="b-num">{formatEuro(totale)}</span></div>
      <p className="b-secondario b-piccolo">{righe.some(r => r.daRicomporre) && 'Il totale è senza le poke da ricomporre. '}Il prezzo finale viene ricontrollato quando confermi.</p>
      {errore && <p role="alert" className="b-avviso b-avviso--ritardo">{errore}</p>}
      <button type="button" className="b-btn b-btn--principale b-btn--barra b-btn--largo" aria-busy={inCorso} disabled={inCorso || !righe.length || righe.some(r => r.daRicomporre)} onClick={async () => { if (await invia()) setAperto(false) }}>{inCorso ? 'Invio in corso…' : azione}</button>
    </Pannello>
  </>
}
