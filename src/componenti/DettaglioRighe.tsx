import type { RigaOrdine } from '@/tavoli/ordini-repo'
export function DettaglioRighe({ righe,area,azioneRiga }: { righe: RigaOrdine[]; area: 'staff' | 'tavolo'; azioneRiga?: (riga: RigaOrdine) => React.ReactNode }) {
  return <ul className={`${area}-righe`}>{righe.map(r => <li key={r.id}>
    {r.annullata ? <s>{r.quantita} × {r.numero !== null ? `${r.numero}. ` : ''}{r.nome}</s> : <strong>{r.quantita} × {r.numero !== null ? `${r.numero}. ` : ''}{r.nome}</strong>}
    {r.annullata && <span> · annullato</span>}
    {r.nota && <p className={`${area}-nota`}>Nota: {r.nota}</p>}
    {r.poke && <div className={`${area}-nota`}>{Object.entries(r.poke).filter(([,v]) => v.length > 0).map(([g,v]) => <p key={g}><strong>{g}:</strong> {v.join(', ')}</p>)}</div>}
    {!r.annullata && azioneRiga?.(r)}
  </li>)}</ul>
}
