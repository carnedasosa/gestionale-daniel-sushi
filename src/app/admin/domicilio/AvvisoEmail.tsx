import { MASSIMO_TENTATIVI_EMAIL, type EmailInErrore } from '@/casa/email-repo'
import { oraRoma, partiRoma } from '@/domain/ora-roma'
const due = (n: number) => String(n).padStart(2,'0')
function quandoRoma(istante: Date): string {
  const p = partiRoma(istante)
  return `${due(p.giorno)}/${due(p.mese)}/${p.anno} alle ${oraRoma(istante)}`
}
/** «Email ai clienti»: compare solo se qualche email ha esaurito i tentativi senza partire. */
export function AvvisoEmail({ errori }: { errori: EmailInErrore }) {
  if (errori.n <= 0) return null
  return <section className="b-card" aria-labelledby="titolo-email"><h2 id="titolo-email" className="b-titolo-3">Email ai clienti</h2>
    <div role="alert" className="b-avviso b-avviso--ritardo b-avviso-email">
      <p><strong>{errori.n === 1 ? '1 email non è partita' : `${errori.n} email non sono partite`} dopo {MASSIMO_TENTATIVI_EMAIL} tentativi.</strong></p>
      <p>Ultimo errore{errori.ultimaIl && <> (email del {quandoRoma(errori.ultimaIl)})</>}: {errori.ultimoErrore ?? 'non registrato'}</p>
      <p>Non verranno più ritentate: contatta a mano, per telefono, i clienti di quegli ordini per avvisarli.</p>
    </div>
  </section>
}
