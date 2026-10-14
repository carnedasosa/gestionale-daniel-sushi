import Link from 'next/link'
import type { Requisito } from '@/domain/apertura-casa'
/** «Si possono aprire gli ordini da casa?»: cosa è a posto e cosa manca, con il link alla sezione giusta. */
export function Requisiti({ voci }: { voci: Requisito[] }) {
  return <ul className="b-requisiti">{voci.map(v => <li key={v.chiave} className={`b-requisito ${v.ok ? 'b-requisito--ok' : 'b-requisito--da-fare'}`}>
    {v.ok ? <span className="b-requisito__segno" role="img" aria-label="Fatto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg></span>
      : <span className="b-requisito__segno" role="img" aria-label="Da fare">!</span>}
    <span className="b-requisito__testo">{v.testo}</span>
    {v.link && <Link href={v.link.href}>{v.link.testo} →</Link>}
  </li>)}</ul>
}
