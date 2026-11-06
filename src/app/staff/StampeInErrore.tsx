'use client'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { oraRoma } from '@/domain/ora-roma'
import { ETICHETTA_STAMPANTE, ETICHETTA_TIPO_LAVORO } from '@/stampa/instradamento'
import type { LavoroInErrore } from '@/stampa/stampe-repo'
import { ignoraStampa, riprovaStampa } from './azioni-stampa'
import type { AzioniDi } from './useEsegui'

export type LavoroInErroreClient = Omit<LavoroInErrore,'creataIl'> & { creataIl: string }

/** Stampe finite in errore, sotto l'allarme della cassa: si rimandano o si tolgono dall'allarme. Lo scontrino si rimanda dal conto. */
export function StampeInErrore({ lavori,azioniDi }: { lavori: LavoroInErroreClient[]; azioniDi: AzioniDi }) {
  if (!lavori.length) return null
  return <ul aria-label="Stampe non riuscite" className="b-stampe-errore b-avviso b-avviso--ritardo b-staff__avviso">
    {lavori.map(l => { const { inCorso,esegui } = azioniDi(`stampa:${l.id}`), nome = ETICHETTA_TIPO_LAVORO[l.tipo]
      return <li key={l.id} className="b-stampe-errore__voce">
        <span><strong>{nome}</strong> · {ETICHETTA_STAMPANTE[l.stampante]}{l.dove && ` · ${l.dove}`} · <span className="b-num">{oraRoma(new Date(l.creataIl))}</span>{l.errore && ` · ${l.errore}`}</span>
        <span className="b-azioni">
          {l.stampante === 'fiscale' ? 'Si rimanda dal conto'
            : <button type="button" className="b-btn b-btn--secondario" disabled={inCorso} onClick={() => esegui(() => riprovaStampa(l.id))}>Riprova</button>}
          <ConfermaAzione stile="secondario" inCorso={inCorso} domanda={`Ignorare ${nome.toLowerCase()} (${ETICHETTA_STAMPANTE[l.stampante]})? Non uscirà più e sparirà dall’avviso.`} conferma={() => esegui(() => ignoraStampa(l.id))}>Ignora</ConfermaAzione>
        </span>
      </li> })}
  </ul>
}
