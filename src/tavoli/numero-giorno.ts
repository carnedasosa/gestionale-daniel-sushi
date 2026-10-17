/** Ora di Roma in cui comincia la giornata di servizio: una serata che passa la mezzanotte continua la stessa numerazione. */
export const ORA_INIZIO_GIORNATA = 5

/**
 * Numero d'ordine della giornata (1, 2, 3…), calcolato in lettura: `ordini.numero` resta il contatore globale nel DB.
 * Forma: `numero - primo numero della giornata + 1`, non `row_number()` sugli ordini del giorno. Il contatore globale
 * cresce con l'ora di creazione, quindi il primo numero di una giornata non cambia più: un ordine arrivato dopo non
 * sposta i numeri già letti da cucina e cliente. `row_number()` (o un conteggio) li sposterebbe invece se un invio
 * più vecchio, ancora in transazione, arriva al commit dopo uno più nuovo. Il prezzo è qualche buco raro (un invio
 * annullato dopo aver preso il numero), innocuo per chi chiama gli ordini.
 * Le due sottoquery usano l'indice unico su `numero`: si scorrono all'indietro solo gli ordini della giornata.
 */
export function numeroGiorno(o: string): string {
  const inizio = `((date_trunc('day',(${o}.creato_il at time zone 'Europe/Rome') - interval '${ORA_INIZIO_GIORNATA} hours') + interval '${ORA_INIZIO_GIORNATA} hours') at time zone 'Europe/Rome')`
  const ultimoPrima = `coalesce((select x.numero from ordini x where x.numero<${o}.numero and x.creato_il<${inizio} order by x.numero desc limit 1),0)`
  return `(${o}.numero - (select y.numero from ordini y where y.numero>${ultimoPrima} order by y.numero limit 1) + 1)::int as "numeroGiorno"`
}
