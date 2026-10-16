import type { Reparto } from './reparti'
// Comanda: la parte di un ordine che prepara un reparto. Lo stato dell'ordine si ricava dalle sue comande.
export const STATI_COMANDA = ['da_preparare','in_preparazione','pronta','annullata'] as const
export type StatoComanda = typeof STATI_COMANDA[number]
export type TipoOrdine = 'tavolo' | 'asporto' | 'domicilio'

export function statoComandaValido(v: unknown): v is StatoComanda {
  return typeof v === 'string' && (STATI_COMANDA as readonly string[]).includes(v)
}

/** Passo successivo: le bevande (sala) passano in un tocco da preparare a pronte, gli altri reparti in due. */
export function prossimoStatoComanda(s: StatoComanda, reparto: Reparto): StatoComanda | null {
  if (reparto === 'sala') return s === 'da_preparare' || s === 'in_preparazione' ? 'pronta' : null
  return s === 'da_preparare' ? 'in_preparazione' : s === 'in_preparazione' ? 'pronta' : null
}

/** Testo del bottone che porta la comanda al passo successivo. */
export function azioneAvanzaComanda(s: StatoComanda, reparto: Reparto): string | null {
  const prossimo = prossimoStatoComanda(s,reparto)
  if (!prossimo) return null
  if (reparto === 'sala') return 'Portate'
  return prossimo === 'in_preparazione' ? 'Inizia a preparare' : 'Segna pronta'
}

export type ColonnaComanda = 'da_preparare' | 'in_preparazione' | 'pronta'
export function colonnaComanda(s: StatoComanda): ColonnaComanda | null {
  return s === 'annullata' ? null : s
}

/**
 * Stato dell'ordine ricavato dalle comande, o null se non cambia.
 * Agisce solo mentre l'ordine è in preparazione (tavolo `inviato|in_preparazione`, casa `accettato|in_preparazione`):
 * accettazione, ritiro, consegna e annullamenti restano passaggi della cassa.
 */
export function statoOrdineDaComande(tipo: TipoOrdine, attuale: string, stati: readonly StatoComanda[]): string | null {
  const tavolo = tipo === 'tavolo'
  const inCucina = tavolo ? ['inviato','in_preparazione'] : ['accettato','in_preparazione']
  if (!inCucina.includes(attuale)) return null
  const attive = stati.filter(s => s !== 'annullata')
  if (!attive.length) return null
  const nuovo = attive.every(s => s === 'da_preparare') ? (tavolo ? 'inviato' : 'accettato')
    : attive.every(s => s === 'pronta') ? (tavolo ? 'servito' : 'pronto') : 'in_preparazione'
  return nuovo === attuale ? null : nuovo
}

/** Comande toccate da un cambio di stato dell'ordine fatto dalla cassa (bottoni a cascata, annullamenti). */
export function comandeInCascata(statoOrdine: string): { da: StatoComanda[]; verso: StatoComanda } | null {
  if (statoOrdine === 'in_preparazione') return { da: ['da_preparare'],verso: 'in_preparazione' }
  if (statoOrdine === 'servito' || statoOrdine === 'pronto') return { da: ['da_preparare','in_preparazione'],verso: 'pronta' }
  if (statoOrdine === 'annullato' || statoOrdine === 'rifiutato') return { da: ['da_preparare','in_preparazione','pronta'],verso: 'annullata' }
  return null
}

export const ETICHETTA_STATO_COMANDA: Record<StatoComanda,string> = { da_preparare: 'da preparare',in_preparazione: 'in preparazione',pronta: 'pronta',annullata: 'annullata' }
