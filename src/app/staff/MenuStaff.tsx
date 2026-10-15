'use client'
import { useState } from 'react'
import { filtraCategorie, type CategoriaElenco } from '@/menu/elenco'
import { InterruttoreDisponibile } from '@/componenti/InterruttoreDisponibile'
import { cambiaDisponibilitaStaff } from './azioni-menu'

/** Scheda «Menù» dello staff: cerca un piatto e segnalo esaurito o di nuovo disponibile durante il servizio. */
export function MenuStaff({ categorie }: { categorie: CategoriaElenco[] | null }) {
  const [testo,setTesto] = useState('')
  if (!categorie) return <p role="status" className="b-secondario">Caricamento del menù…</p>
  const trovate = filtraCategorie(categorie,testo)
  const esauriti = categorie.flatMap(c => c.piatti).filter(p => !p.disponibile).length
  return <div className="b-menu-staff">
    <div className="b-menu-staff__testa">
      <label className="b-campo">Cerca un piatto<input type="search" value={testo} onChange={e => setTesto(e.target.value)} placeholder="Sake roll, 29…" /></label>
      <p className="b-secondario" role="status">{esauriti ? `${esauriti} ${esauriti === 1 ? 'piatto esaurito' : 'piatti esauriti'} stasera` : 'Tutti i piatti sono disponibili'}</p>
    </div>
    {!trovate.length && <p className="b-avviso">Nessun piatto trovato.</p>}
    {trovate.map(c => <section key={c.id} aria-labelledby={`menu-${c.id}`} className="b-menu-staff__categoria">
      <h2 id={`menu-${c.id}`} className="b-colonna__titolo">{c.nome}</h2>
      <ul className="b-lista">{c.piatti.map(p => <li key={p.id} className={`b-menu-staff__piatto${p.disponibile ? '' : ' b-menu-staff__piatto--esaurito'}`}>
        <span className="b-menu-staff__nome">{p.numero !== null && <span className="b-num b-secondario">{p.numero} </span>}{p.nome}</span>
        <InterruttoreDisponibile id={p.id} nome={p.nome} disponibile={p.disponibile} cambia={cambiaDisponibilitaStaff} />
      </li>)}</ul>
    </section>)}
  </div>
}
