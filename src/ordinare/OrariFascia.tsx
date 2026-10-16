'use client'
import { oraRoma } from '@/domain/ora-roma'
/** `sotto`: riga piccola sotto l'ora (es. l'occupazione «3/4» per la cassa). */
export interface OrarioFascia { f: string; piena: boolean; sotto?: string }
/** Griglia di orari a scelta singola. Gli orari pieni sono barrati e non selezionabili, salvo `forzati` (solo dalla cassa). */
export function OrariFascia({ orari,valore,onChange,disabilitato,etichetta,invalido,forzati = false,className }: {
  orari: OrarioFascia[]; valore: string; onChange: (f: string) => void; disabilitato: boolean; etichetta: string; invalido: boolean; forzati?: boolean; className?: string
}) {
  return <div className={className ? `b-orari ${className}` : 'b-orari'} role="radiogroup" aria-label={etichetta} aria-invalid={invalido}>{orari.map(({ f,piena,sotto }) => {
    const bloccato = piena && !forzati
    return <label key={f} className={bloccato ? 'b-orario b-orario--pieno' : piena ? 'b-orario b-orario--forzato' : 'b-orario'}>
      <input type="radio" name="fascia" value={f} checked={valore === f} disabled={bloccato || disabilitato} onChange={() => onChange(f)} />
      {bloccato ? <><s>{oraRoma(new Date(f))}</s><span className="b-nascosto"> pieno</span></> : <span className="b-num">{oraRoma(new Date(f))}</span>}
      {sotto && <span className="b-orario__sotto b-num">{sotto}</span>}
    </label> })}</div>
}
