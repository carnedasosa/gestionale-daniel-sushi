import { tonoStato } from '@/domain/toni-stato'
import type { StatoOrdineTavolo } from '@/domain/stati-tavolo'
import type { StatoCasa } from '@/domain/stati-casa'
/** Stato d'ordine scritto e colorato: il colore aiuta, il testo dice. */
export function EtichettaStato({ stato,testo }: { stato: StatoOrdineTavolo | StatoCasa; testo: string }) {
  return <span className={`b-stato b-stato--${tonoStato(stato)}`}><span className="b-stato__punto" aria-hidden="true" />{testo}</span>
}
