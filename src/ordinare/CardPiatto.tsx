import type { Piatto } from '@/menu/repo'
import { testoAllergeni } from '@/menu/testo-allergeni'
import Image from 'next/image'
import { formatEuro } from '@/domain/soldi'
import { urlFoto } from '@/domain/foto'
import { ETICHETTA_FORMATO, testoVino } from '@/domain/vini'
/** Piatto del menù. Senza `modifica` è solo da consultare (nessun bottone). */
export function CardPiatto({ piatto: p,quantita = 0,modifica }: { piatto: Piatto; quantita?: number; modifica?: (q: number) => void }) {
  const etichette = p.dellaCasa || p.piccante || p.vegetariano || !p.disponibile
  return <article className={p.disponibile ? 'b-piatto' : 'b-piatto b-piatto--esaurito'}>
    <span className="b-num b-piatto__numero">{p.numero ?? ''}</span>
    <div className="b-piatto__corpo">
      {/* unoptimized: la foto è già rimpicciolita al caricamento e la serve /foto con cache lunga. */}
      {p.foto && <Image className="b-piatto__foto" src={urlFoto(p.id,p.foto.versione)} width={p.foto.larghezza} height={p.foto.altezza} alt={`Foto: ${p.nome}`} loading="lazy" unoptimized />}
      <h3 className="b-piatto__nome">{p.nome}</h3>
      {p.vino && testoVino(p.vino) && <p className="b-piatto__vino">{testoVino(p.vino)}</p>}
      {p.descrizione && <p className="b-piatto__desc">{p.descrizione}</p>}
      {etichette && <div className="b-piatto__etichette">
        {p.dellaCasa && <span className="b-etichetta">Della casa</span>}
        {p.piccante && <span className="b-etichetta b-etichetta--accettare">Piccante</span>}
        {p.vegetariano && <span className="b-etichetta b-etichetta--pronto">Vegetariano</span>}
        {!p.disponibile && <span className="b-etichetta">Esaurito stasera</span>}
      </div>}
      <p className="b-piatto__allergeni">{testoAllergeni(p)}</p>
      <span className="b-num b-piatto__prezzo">{formatEuro(p.prezzoCent)}{p.vino && <span className="b-piatto__formato"> · {ETICHETTA_FORMATO[p.vino.formato]}</span>}</span>
    </div>
    {p.disponibile && modifica && <div className="b-piatto__azioni">{quantita
      ? <div className="b-quantita" role="group" aria-label={`Quantità di ${p.nome}`}>
          <button type="button" className="b-quantita__btn" aria-label={`Riduci ${p.nome}`} onClick={() => modifica(quantita - 1)}>−</button>
          <span className="b-num" aria-live="polite">{quantita}</span>
          <button type="button" className="b-quantita__btn" aria-label={`Aumenta ${p.nome}`} disabled={quantita >= 20} onClick={() => modifica(quantita + 1)}>+</button>
        </div>
      : <button type="button" className="b-btn b-btn--secondario b-btn--tondo b-piatto__aggiungi" aria-label={`Aggiungi ${p.nome}`} onClick={() => modifica(1)}>+</button>}
    </div>}
  </article>
}
