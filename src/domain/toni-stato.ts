import type { StatoOrdineTavolo } from './stati-tavolo'
import type { StatoCasa } from './stati-casa'
export type Tono = 'accettare' | 'preparare' | 'preparazione' | 'pronto' | 'ritardo'
/** Colore di uno stato d'ordine (tavolo o casa): lo stesso in tutta l'app. */
export function tonoStato(stato: StatoOrdineTavolo | StatoCasa): Tono {
  switch (stato) {
    case 'in_attesa': return 'accettare'
    case 'inviato': case 'accettato': return 'preparare'
    case 'in_preparazione': return 'preparazione'
    case 'pronto': case 'in_consegna': case 'servito': case 'completato': return 'pronto'
    case 'rifiutato': case 'annullato': return 'ritardo'
  }
}
