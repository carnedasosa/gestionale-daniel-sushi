import type { RigaOrdine } from '@/tavoli/ordini-repo'
import { ETICHETTA_REPARTO, raggruppaPerReparto } from '@/domain/reparti'
type AzioneRiga = (riga: RigaOrdine) => React.ReactNode
// Stesso aspetto in cucina e per il cliente; il numero del piatto serve solo alla cucina (`area` staff).
// `perReparto`: in area staff, se l'ordine tocca più reparti, le righe si dividono sotto «Banco sushi», «Cucina», «Sala».
export function DettaglioRighe({ righe,area,azioneRiga,perReparto = false }: { righe: RigaOrdine[]; area: 'staff' | 'tavolo'; azioneRiga?: AzioneRiga; perReparto?: boolean }) {
  const gruppi = perReparto && area === 'staff' ? raggruppaPerReparto(righe) : []
  if (gruppi.length < 2) return <Righe righe={righe} area={area} azioneRiga={azioneRiga} />
  return <div className="b-righe-reparti">{gruppi.map(g => <section key={g.reparto} aria-label={ETICHETTA_REPARTO[g.reparto]}>
    <p className="b-occhiello">{ETICHETTA_REPARTO[g.reparto]}</p>
    <Righe righe={g.righe} area={area} azioneRiga={azioneRiga} />
  </section>)}</div>
}
function Righe({ righe,area,azioneRiga }: { righe: RigaOrdine[]; area: 'staff' | 'tavolo'; azioneRiga?: AzioneRiga }) {
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
