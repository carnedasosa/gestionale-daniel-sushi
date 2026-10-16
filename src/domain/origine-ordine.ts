/** Da dove nasce un ordine: telefono del cliente (QR o sito), cassa (telefonata o WhatsApp), cameriere per un tavolo. */
export type OrigineOrdine = 'cliente' | 'cassa' | 'cameriere'
export const ORIGINI: readonly OrigineOrdine[] = ['cliente','cassa','cameriere']
export function origineValida(v: unknown): v is OrigineOrdine { return (ORIGINI as readonly unknown[]).includes(v) }
/** Etichetta da mostrare allo staff; nessuna per gli ordini del cliente, che sono la norma. */
export function etichettaOrigine(o: OrigineOrdine): string | null {
  return o === 'cassa' ? 'Dalla cassa' : o === 'cameriere' ? 'Dal cameriere' : null
}
