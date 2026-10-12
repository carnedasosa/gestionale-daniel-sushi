import Link from 'next/link'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { allergeniCompleti, elencoChiusure, elencoOrari, elencoZone, leggiImpostazioni } from '@/casa/impostazioni-repo'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { pokeOrdinabile } from '@/domain/poke'
import { dataRoma } from '@/domain/ora-roma'
import { GIORNI } from '@/domain/valida-domicilio'
import { BottoneRimuovi, ModuloChiusura, ModuloImpostazioni, ModuloOrario, ModuloZona } from './ModuliDomicilio'
import { rimuoviChiusuraCasa, rimuoviOrarioCasa } from './azioni'
export default async function DomicilioAdmin() {
  await richiediRuolo('admin')
  const oggi = dataRoma(new Date())
  const [impostazioni,zone,orari,chiusure,completi,config] = [await leggiImpostazioni(db),await elencoZone(db),await elencoOrari(db),await elencoChiusure(db,oggi),await allergeniCompleti(db),await leggiPokeConfig(db)]
  const poke = config && pokeOrdinabile(config) ? await leggiAllergeniPoke(db,config) : null
  return <>
    <h1 className="heading">Domicilio e asporto</h1>
    <p>Gli ordini da casa arrivano solo quando lo staff li apre dallo schermo staff, negli orari qui sotto e per il giorno stesso.</p>
    {!completi && <p className="admin-avviso">Ci sono piatti disponibili con allergeni da confermare: gli ordini da casa restano chiusi finché non li confermi nel <Link className="ds-link" href="/admin/menu">menù</Link>.</p>}
    {poke && !poke.confermati && <p className="admin-avviso">La poke composta non si può ordinare da casa finché non confermi gli <Link className="ds-link" href="/admin/poke">allergeni degli ingredienti</Link>.</p>}
    {!impostazioni.telefono && <p className="admin-avviso">Imposta il telefono del locale: senza, gli ordini online non si aprono.</p>}
    <section><h2 className="heading">Impostazioni</h2><ModuloImpostazioni impostazioni={impostazioni} /></section>
    <section><h2 className="heading">Zone di consegna</h2><p>Le zone non si cancellano: disattivale. Gli ordini già fatti conservano nome e costo.</p>
      <div className="admin-tavoli">{zone.map(z => <ModuloZona key={z.id} zona={z} />)}<ModuloZona /></div></section>
    <section><h2 className="heading">Orari</h2><p>Turni di asporto e domicilio per ogni giorno. Le fasce iniziano ogni 15 minuti, dall’inizio del turno fino a 15 minuti prima della fine.</p>
      <div className="admin-tavoli">{GIORNI.map((nome,i) => <article key={nome} className="admin-tavolo ds-card"><h3 className="heading-sm">{nome}</h3>
        {(['asporto','domicilio'] as const).map(s => { const turni = orari.filter(o => o.giorno === i + 1 && o.servizio === s)
          return <div key={s}><p><strong>{s === 'asporto' ? 'Asporto' : 'Domicilio'}</strong>{!turni.length && ': nessun turno'}</p>
            <ul className="admin-turni">{turni.map(o => <li key={o.id}>{o.dalle}–{o.alle}<BottoneRimuovi etichetta={`${s} ${nome} ${o.dalle}`} rimuovi={rimuoviOrarioCasa.bind(null,o.id)} /></li>)}</ul></div> })}
      </article>)}<ModuloOrario /></div></section>
    <section><h2 className="heading">Chiusure straordinarie</h2>{!chiusure.length && <p>Nessuna chiusura in programma.</p>}
      <ul className="admin-turni">{chiusure.map(c => <li key={c.data}>{new Date(`${c.data}T12:00:00Z`).toLocaleDateString('it-IT',{ weekday: 'long',day: 'numeric',month: 'long',year: 'numeric',timeZone: 'Europe/Rome' })}{c.motivo && ` · ${c.motivo}`}
        <BottoneRimuovi etichetta={c.data} rimuovi={rimuoviChiusuraCasa.bind(null,c.data)} /></li>)}</ul>
      <ModuloChiusura /></section>
  </>
}
