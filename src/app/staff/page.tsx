import { unstable_rethrow } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import { db } from '@/server/db'
import { elencoTavoli, contiRecenti } from '@/tavoli/repo'
import { ordiniAttivi, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { InizioTurno } from './InizioTurno'
import { SchermoStaff } from './SchermoStaff'
import './staff.css'

export default async function AreaStaff() {
  let dati = null
  try {
    // Anche il ruolo si legge dal DB: se il DB non risponde lo schermo resta montato con gli ultimi
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)])
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
  const ora = new Date().toISOString()
  const datiStaff = dati ? {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
  } : null
  return (
    <main className="contenitore staff-pagina">
      <header className="staff-barra"><h1 className="heading">Area staff</h1><form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form></header>
      <AggiornamentoAutomatico ogniSecondi={5} ultimoAggiornamento={dati ? ora : undefined} />
      {!dati && <p role="status" className="staff-nota">Database non raggiungibile, riprovo da solo… Lo schermo mostra gli ultimi dati ricevuti.</p>}
      {/* Sempre montati, anche se la lettura fallisce: suono e ordini già visti non si perdono. */}
      <InizioTurno><SchermoStaff ora={ora} dati={datiStaff} /></InizioTurno>
    </main>
  )
}
