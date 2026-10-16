'use client'
import { useContext } from 'react'
import type { ComandaClient } from '@/comande/comande-repo'
import { colonnaComanda } from '@/domain/comande'
import { ETICHETTA_REPARTO } from '@/domain/reparti'
import type { Postazione } from '@/domain/postazioni'
import type { CategoriaElenco } from '@/menu/elenco'
import { SuonoTurno } from './InizioTurno'
import { BarraStaff } from './BarraStaff'
import { MenuStaff } from './MenuStaff'
import { CardComanda } from './CardComanda'
import { useArrivi } from './useArrivi'
import { useEsegui, useUltimiDati } from './useEsegui'
import type { VistaStaff } from './vista'

export interface DatiReparto { comande: ComandaClient[]; menu?: CategoriaElenco[] | null }
const COLONNE = [
  { chiave: 'da_preparare',titolo: 'Da preparare',punto: '' },
  { chiave: 'in_preparazione',titolo: 'In preparazione',punto: 'b-punto--preparazione' },
  { chiave: 'pronta',titolo: 'Pronte',punto: 'b-punto--pronto' },
] as const
/** Schermo del banco sushi o della cucina: solo le comande del proprio reparto. Suona a ogni comanda nuova. */
export function SchermoReparto({ postazione,dati,ora,vista = 'ordini',uscita }: { postazione: Extract<Postazione,'banco' | 'cucina'>; dati: DatiReparto | null; ora: string; vista?: VistaStaff; uscita?: React.ReactNode }) {
  const mostrati = useUltimiDati(dati)
  const comande = mostrati?.comande
  const suona = useContext(SuonoTurno)
  const { esegui,inCorso,errore } = useEsegui()
  const { nuovi,leggi } = useArrivi(`ds_arrivi_${postazione}`,comande?.map(c => c.id),() => suona(3))
  const barra = (n: number) => <BarraStaff postazione={postazione} vista={vista} daGuardare={n} online={null} ora={ora} uscita={uscita} />
  if (!comande) return <>{barra(0)}<p role="status" className="b-staff__vuoto">Caricamento dello schermo…</p></>
  return <>
    {barra(nuovi.length)}
    {errore && <p role="alert" className="b-avviso b-avviso--ritardo b-staff__avviso">{errore}</p>}
    <section aria-label="Ordini" hidden={vista !== 'ordini'} className="b-staff__vista">
      <h2 className="b-nascosto">Comande · {ETICHETTA_REPARTO[postazione]}</h2>
      <div className="b-colonne b-colonne--reparto">
        {COLONNE.map(col => { const qui = comande.filter(c => colonnaComanda(c.stato) === col.chiave)
          return <section key={col.chiave} className="b-colonna" aria-labelledby={`col-${col.chiave}`}>
            <h2 id={`col-${col.chiave}`} className="b-colonna__titolo"><span className={`b-punto ${col.punto}`} aria-hidden="true" />{col.titolo} <span className="b-num b-secondario">{qui.length}</span></h2>
            {!qui.length && <p className="b-secondario">Nessuna comanda.</p>}
            {qui.map(c => <CardComanda key={c.id} comanda={c} ora={ora} nuova={nuovi.includes(c.id)} inCorso={inCorso} leggi={() => leggi(c.id)} esegui={esegui} />)}
          </section> })}
      </div>
    </section>
    <section aria-label="Menù" hidden={vista !== 'menu'} className="b-staff__vista">
      {vista === 'menu' && <MenuStaff categorie={mostrati.menu ?? null} />}
    </section>
  </>
}
