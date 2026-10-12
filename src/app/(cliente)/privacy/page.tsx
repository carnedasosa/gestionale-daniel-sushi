import Link from 'next/link'
import '../casa.css'
// Testo provvisorio: va sostituito con quello fornito e validato dal locale (spec §6 e §9).
export default function Privacy() {
  return <main className="contenitore casa-pagina casa-testo">
    <h1 className="heading">Informativa privacy</h1>
    <p className="casa-avviso">Testo provvisorio, da validare dal locale prima di aprire gli ordini online.</p>
    <p>Titolare del trattamento è Daniel’s Sushi, Via Beato Giacomo 72, Bitetto (BA).</p>
    <h2 className="heading-sm">Quali dati raccogliamo</h2>
    <p>Per gli ordini da asporto e a domicilio raccogliamo solo i dati che servono a prepararli e consegnarli: nome, telefono, email e, per il domicilio, indirizzo e note per il fattorino. Registriamo anche l’indirizzo di rete da cui arriva l’ordine, per limitare gli abusi.</p>
    <h2 className="heading-sm">Perché li usiamo</h2>
    <p>Per gestire il tuo ordine: confermarlo, prepararlo, consegnarlo e avvisarti via email dei cambi di stato. Non li usiamo per pubblicità e non li cediamo ad altri.</p>
    <h2 className="heading-sm">Per quanto tempo</h2>
    <p>Dopo 12 mesi i dati personali degli ordini vengono cancellati; restano solo importi e piatti, in forma anonima, per le statistiche del locale.</p>
    <h2 className="heading-sm">Chi li tratta per noi</h2>
    <p>I dati sono conservati sui server dei fornitori dell’applicazione (hosting, database e invio delle email), che li trattano solo per nostro conto.</p>
    <h2 className="heading-sm">I tuoi diritti</h2>
    <p>Puoi chiedere di vedere, correggere o cancellare i tuoi dati scrivendoci o chiamando il locale.</p>
    <p><Link className="ds-link" href="/">Torna al menù</Link></p>
  </main>
}
