import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { allergeniCompleti, elencoChiusure, elencoOrari, elencoZone, leggiImpostazioni } from '@/casa/impostazioni-repo'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { pokeOrdinabile } from '@/domain/poke'
import { requisitiCasa } from '@/domain/apertura-casa'
import { formatEuro } from '@/domain/soldi'
import { dataRoma } from '@/domain/ora-roma'
import { GIORNI } from '@/domain/valida-domicilio'
import { ApriInPannello } from '@/componenti/ApriInPannello'
import { BottoneRimuovi, ModuloChiusura, ModuloImpostazioni, ModuloOrario, ModuloZona } from './ModuliDomicilio'
import { Requisiti } from './Requisiti'
import { rimuoviChiusuraCasa, rimuoviOrarioCasa } from './azioni'
export default async function DomicilioAdmin() {
  await richiediRuolo('admin')
  const oggi = dataRoma(new Date())
  const [impostazioni,zone,orari,chiusure,completi,config] = [await leggiImpostazioni(db),await elencoZone(db),await elencoOrari(db),await elencoChiusure(db,oggi),await allergeniCompleti(db),await leggiPokeConfig(db)]
  const poke = config && pokeOrdinabile(config) ? await leggiAllergeniPoke(db,config) : null
  const voci = requisitiCasa({ telefono: impostazioni.telefono,allergeniCompleti: completi,pokeConfermati: poke ? poke.confermati : null,zoneAttive: zone.filter(z => z.attiva).length })
  return <>
    <div className="b-admin-testa"><div className="b-admin-testa__testi"><h1 className="b-titolo-1">Domicilio e asporto</h1>
      <p className="b-secondario">Gli ordini da casa arrivano solo per oggi, negli orari qui sotto, e solo dopo che lo staff li apre dal tablet.</p></div></div>
    <section className="b-card" aria-labelledby="titolo-requisiti"><h2 id="titolo-requisiti" className="b-titolo-3">Si possono aprire gli ordini da casa?</h2><Requisiti voci={voci} /></section>
    <div className="b-admin-due">
      <section className="b-card b-admin-largo" aria-labelledby="titolo-orari">
        <div className="b-admin-sezione__testa"><h2 id="titolo-orari" className="b-titolo-3">Orari della settimana</h2><ApriInPannello etichetta="Aggiungi turno" titolo="Aggiungi turno"><ModuloOrario /></ApriInPannello></div>
        <div className="b-tabella-scorre"><table className="b-tabella"><thead><tr><th>Giorno</th><th>Asporto</th><th>Domicilio</th></tr></thead>
          <tbody>{GIORNI.map((nome,i) => <tr key={nome}><td><strong>{nome}</strong></td>{(['asporto','domicilio'] as const).map(s => { const turni = orari.filter(o => o.giorno === i + 1 && o.servizio === s)
            return <td key={s}>{turni.length ? <div className="b-turni">{turni.map(o => <span key={o.id} className="b-turno">{o.dalle}–{o.alle}<BottoneRimuovi compatto etichetta={`${s} ${nome} ${o.dalle}`} rimuovi={rimuoviOrarioCasa.bind(null,o.id)} /></span>)}</div> : <span className="b-secondario">Nessun turno</span>}</td> })}</tr>)}</tbody></table></div>
        <p className="b-secondario b-piccolo">Le fasce partono ogni 15 minuti, dall’inizio del turno fino a 15 minuti prima della fine.</p>
      </section>
      <div className="b-admin-sezione">
        <section id="zone" className="b-card" aria-labelledby="titolo-zone">
          <div className="b-admin-sezione__testa"><h2 id="titolo-zone" className="b-titolo-3">Zone di consegna</h2><ApriInPannello etichetta="Aggiungi" titolo="Aggiungi zona"><ModuloZona /></ApriInPannello></div>
          {!zone.length && <p className="b-secondario">Nessuna zona: il domicilio resta chiuso.</p>}
          {zone.map(z => <ApriInPannello key={z.id} classe={z.attiva ? 'b-zona' : 'b-zona b-zona--spenta'} titolo={`Zona ${z.nome}`} etichetta={<><span className="b-zona__testa"><span>{z.nome}</span><span className="b-piccolo">{z.attiva ? 'Attiva' : 'Disattivata'}</span></span>
            <span className="b-num b-piccolo b-secondario">consegna {formatEuro(z.costoCent)} · minimo {formatEuro(z.minimoCent)}</span></>}><ModuloZona zona={z} /></ApriInPannello>)}
          <p className="b-secondario b-piccolo">Le zone non si cancellano: disattivale. Gli ordini già fatti conservano nome e costo.</p>
        </section>
        <section id="impostazioni" className="b-admin-sezione" aria-labelledby="titolo-capacita"><h2 id="titolo-capacita" className="b-titolo-3">Quanti ordini reggiamo</h2><ModuloImpostazioni impostazioni={impostazioni} /></section>
      </div>
    </div>
    <section className="b-card" aria-labelledby="titolo-chiusure">
      <div className="b-admin-sezione__testa"><h2 id="titolo-chiusure" className="b-titolo-3">Chiusure straordinarie</h2><ApriInPannello etichetta="Aggiungi un giorno" titolo="Aggiungi chiusura"><ModuloChiusura /></ApriInPannello></div>
      {!chiusure.length && <p className="b-secondario">Nessuna chiusura in programma.</p>}
      <ul className="b-chiusure">{chiusure.map(c => <li key={c.data} className="b-chiusura"><span className="b-num">{new Date(`${c.data}T12:00:00Z`).toLocaleDateString('it-IT',{ weekday: 'short',day: '2-digit',month: '2-digit',timeZone: 'Europe/Rome' })}</span>
        <span>{new Date(`${c.data}T12:00:00Z`).toLocaleDateString('it-IT',{ weekday: 'long',day: 'numeric',month: 'long',year: 'numeric',timeZone: 'Europe/Rome' })}{c.motivo && ` · ${c.motivo}`}</span>
        <BottoneRimuovi etichetta={c.data} rimuovi={rimuoviChiusuraCasa.bind(null,c.data)} /></li>)}</ul>
    </section>
  </>
}
