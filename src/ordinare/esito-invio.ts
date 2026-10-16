/** Esito di un invio al tavolo, dal telefono del cliente o dal cameriere: stesso contratto per i due menù. */
export interface EsitoInvio { ok: boolean; errore?: string; nonDisponibili?: string[]; nonDisponibiliIds?: string[]; numero?: number }
