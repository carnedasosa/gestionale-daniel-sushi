'use client'
import Link from 'next/link'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'
import { filtraCategorie, type CategoriaElenco } from '@/menu/elenco'
import { InterruttoreDisponibile, type CambiaDisponibilita } from '@/componenti/InterruttoreDisponibile'
import { FilaCategorie, useBarraCategorie } from '@/componenti/BarraCategorie'

export { filtraCategorie, type CategoriaElenco, type PiattoElenco } from '@/menu/elenco'

const Allergeni = ({ ok }: { ok: boolean }) => <span className={`b-etichetta ${ok ? 'b-etichetta--pronto' : 'b-etichetta--accettare'}`}>{ok ? 'Confermati' : 'Da confermare'}</span>
/** Elenco dei piatti dell'admin, con ricerca istantanea e interruttore della disponibilità. */
export function ElencoPiatti({ categorie,cambia }: { categorie: CategoriaElenco[]; cambia: CambiaDisponibilita }) {
  const [testo,setTesto] = useState('')
  const trovate = filtraCategorie(categorie,testo)
  const { testa:rifTesta,fila:rifFila,pillole:rifPillole,...fila } = useBarraCategorie(trovate.map(c => c.id))
  return <>
    <div ref={rifTesta} className="b-elenco-testa">
      <label className="b-campo b-admin-cerca">Cerca un piatto<input type="search" value={testo} onChange={e => setTesto(e.target.value)} placeholder="Sake roll, 29…" /></label>
      {trovate.length > 0 && <FilaCategorie categorie={trovate} rifFila={rifFila} rifPillole={rifPillole} stato={fila} className="b-elenco-categorie" />}
    </div>
    {!trovate.length && <p className="b-avviso">Nessun piatto trovato.</p>}
    {trovate.map(c => <section key={c.id} id={`sez-${c.id}`} className="b-admin-sezione b-admin-sezione--categoria" aria-labelledby={`cat-${c.id}`}>
      <div className="b-menu-sezione__testa"><h2 id={`cat-${c.id}`} className="b-titolo-2" tabIndex={-1}>{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      <div className="b-tabella-scorre" role="region" aria-label={`Piatti: ${c.nome}`} tabIndex={0}>
        <table className="b-tabella b-tabella-piatti">
          <thead><tr><th>N.</th><th>Piatto</th><th className="b-destra">Prezzo</th><th>Allergeni</th><th>Stasera</th><th><span className="b-nascosto">Azioni</span></th></tr></thead>
          <tbody>{c.piatti.map(p => <tr key={p.id} className={p.disponibile ? undefined : 'b-esaurito'}>
            <td className="b-num">{p.numero ?? '—'}</td><td><strong>{p.nome}</strong></td><td className="b-num b-destra">{formatEuro(p.prezzoCent)}</td>
            <td><Allergeni ok={p.allergeniConfermati} /></td><td><InterruttoreDisponibile id={p.id} nome={p.nome} disponibile={p.disponibile} cambia={cambia} /></td>
            <td className="b-destra"><Link href={`/admin/menu/${p.id}`}>Modifica<span className="b-nascosto"> {p.nome}</span></Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="b-lista b-righe-piatti">{c.piatti.map(p => <div key={p.id} className="b-riga-piatto">
        <Link href={`/admin/menu/${p.id}`} className="b-riga-piatto__testo"><strong>{p.numero !== null && <span className="b-num b-secondario">{p.numero} </span>}{p.nome}</strong>
          <span className="b-piccolo">{p.allergeniConfermati ? 'Allergeni confermati' : 'Allergeni da confermare'} · <span className="b-num">{formatEuro(p.prezzoCent)}</span></span></Link>
        <InterruttoreDisponibile id={p.id} nome={p.nome} disponibile={p.disponibile} cambia={cambia} />
      </div>)}</div>
    </section>)}
  </>
}
