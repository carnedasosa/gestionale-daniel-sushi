export interface InvioIncasso {
  /** Chiave con cui mandare la richiesta, o null se ce n'è già una in volo (doppio tocco). */
  parti: () => string | null
  /** Risposta arrivata o rete caduta: `chiaveConsumata` se il server ha confermato l'incasso o dice che la chiave è di un altro. */
  finito: (chiaveConsumata: boolean) => void
}
/**
 * Regola della chiave di invio di un incasso: una richiesta alla volta, e la stessa chiave finché non è consumata.
 * Dopo un errore di rete l'incasso può essere arrivato; anche «registrato, ma lo scontrino non è partito» è un esito negativo
 * con l'incasso già scritto. Riprovare con la stessa chiave è sempre sicuro: se non c'è niente di scritto, si scrive adesso;
 * se è scritto e la richiesta è cambiata (altre persone, altro metodo) il server risponde `chiaveUsata` e non incassa due volte.
 * Per questo la chiave non segue i cambi del pannello: una chiave nuova, dopo un errore di rete, lascerebbe di guardia il solo residuo.
 * Separata dal componente per provarla senza DOM.
 */
export function creaInvioIncasso(nuovaChiave: () => string = () => crypto.randomUUID()): InvioIncasso {
  let chiave: string | null = null, inVolo = false
  return {
    parti() {
      if (inVolo) return null
      inVolo = true
      chiave ??= nuovaChiave()
      return chiave
    },
    finito(chiaveConsumata) {
      inVolo = false
      if (chiaveConsumata) chiave = null
    },
  }
}
