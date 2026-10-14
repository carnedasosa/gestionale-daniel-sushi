'use client'
import Link from 'next/link'
import { useState } from 'react'
import { formatEuro } from '@/domain/soldi'

export interface PiattoElenco { id: string; numero: number | null; nome: string; prezzoCent: number; allergeniConfermati: boolean; disponibile: boolean }
export interface CategoriaElenco { id: string; nome: string; pezzi: string | null; piatti: PiattoElenco[] }
const semplice = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()
/** Piatti che corrispondono alla ricerca: per nome (senza accenti né maiuscole) o per numero esatto. */
export function filtraCategorie(categorie: CategoriaElenco[], testo: string): CategoriaElenco[] {
  const q = semplice(testo)
  if (!q) return categorie
  return categorie.map(c => ({ ...c,piatti: c.piatti.filter(p => /^\d+$/.test(q) ? p.numero === Number(q) : semplice(p.nome).includes(q)) })).filter(c => c.piatti.length)
}
function Interruttore({ p,cambia }: { p: PiattoElenco; cambia: (id: string, disponibile: boolean) => Promise<void> }) {
  return <form action={cambia.bind(null,p.id,!p.disponibile)}>
    <button className="b-interruttore" role="switch" aria-checked={p.disponibile}><span className="b-nascosto">{p.nome}: </span><span className="b-interruttore__binario" aria-hidden="true" />{p.disponibile ? 'Disponibile' : 'Esaurito'}</button>
  </form>
}
const Allergeni = ({ ok }: { ok: boolean }) => <span className={`b-etichetta ${ok ? 'b-etichetta--pronto' : 'b-etichetta--accettare'}`}>{ok ? 'Confermati' : 'Da confermare'}</span>
/** Elenco dei piatti dell'admin, con ricerca istantanea e interruttore della disponibilità. */
export function ElencoPiatti({ categorie,cambia }: { categorie: CategoriaElenco[]; cambia: (id: string, disponibile: boolean) => Promise<void> }) {
  const [testo,setTesto] = useState('')
  const trovate = filtraCategorie(categorie,testo)
  return <>
    <label className="b-campo b-admin-cerca">Cerca un piatto<input type="search" value={testo} onChange={e => setTesto(e.target.value)} placeholder="Sake roll, 29…" /></label>
    {!trovate.length && <p className="b-avviso">Nessun piatto trovato.</p>}
    {trovate.map(c => <section key={c.id} className="b-admin-sezione" aria-labelledby={`cat-${c.id}`}>
      <div className="b-menu-sezione__testa"><h2 id={`cat-${c.id}`} className="b-titolo-2">{c.nome}</h2>{c.pezzi && <span className="b-num b-secondario">{c.pezzi}</span>}</div>
      <div className="b-tabella-scorre" role="region" aria-label={`Piatti: ${c.nome}`} tabIndex={0}>
        <table className="b-tabella b-tabella-piatti">
          <thead><tr><th>N.</th><th>Piatto</th><th className="b-destra">Prezzo</th><th>Allergeni</th><th>Stasera</th><th><span className="b-nascosto">Azioni</span></th></tr></thead>
          <tbody>{c.piatti.map(p => <tr key={p.id} className={p.disponibile ? undefined : 'b-esaurito'}>
            <td className="b-num">{p.numero ?? '—'}</td><td><strong>{p.nome}</strong></td><td className="b-num b-destra">{formatEuro(p.prezzoCent)}</td>
            <td><Allergeni ok={p.allergeniConfermati} /></td><td><Interruttore p={p} cambia={cambia} /></td>
            <td className="b-destra"><Link href={`/admin/menu/${p.id}`}>Modifica<span className="b-nascosto"> {p.nome}</span></Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="b-lista b-righe-piatti">{c.piatti.map(p => <div key={p.id} className="b-riga-piatto">
        <Link href={`/admin/menu/${p.id}`} className="b-riga-piatto__testo"><strong>{p.numero !== null && <span className="b-num b-secondario">{p.numero} </span>}{p.nome}</strong>
          <span className="b-piccolo">{p.allergeniConfermati ? 'Allergeni confermati' : 'Allergeni da confermare'} · <span className="b-num">{formatEuro(p.prezzoCent)}</span></span></Link>
        <Interruttore p={p} cambia={cambia} />
      </div>)}</div>
    </section>)}
  </>
}
