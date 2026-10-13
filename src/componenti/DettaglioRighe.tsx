import type { RigaOrdine } from '@/tavoli/ordini-repo'
// Stesso aspetto in cucina e per il cliente; il numero del piatto serve solo alla cucina (`area` staff).
export function DettaglioRighe({ righe,area,azioneRiga }: { righe: RigaOrdine[]; area: 'staff' | 'tavolo'; azioneRiga?: (riga: RigaOrdine) => React.ReactNode }) {
  return <ul className="b-righe">{righe.map(r => {
    const nome = <>{area === 'staff' && r.numero !== null && <span className="b-num b-secondario">{r.numero} </span>}{r.nome}</>
    const poke = r.poke ? Object.entries(r.poke).filter(([,v]) => v.length > 0) : []
    return <li key={r.id} className={r.annullata ? 'b-riga b-riga__annullata' : 'b-riga'}>
      <div className="b-riga__testa">
        {r.annullata ? <><s><span className="b-num">{r.quantita}×</span> {nome}</s><span> · annullato</span></> : <><strong className="b-num">{r.quantita}×</strong> <span>{nome}</span></>}
        {!r.annullata && azioneRiga?.(r)}
      </div>
      {r.nota && <p className="b-nota">Nota: {r.nota}</p>}
      {poke.length > 0 && <p className="b-riga__poke">{poke.map(([g,v],i) => <span key={g}>{i > 0 && ' · '}<strong>{g}:</strong> {v.join(', ')}</span>)}</p>}
    </li>
  })}</ul>
}
