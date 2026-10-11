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
  await richiediRuolo('staff')
  let dati = null
  try { dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)]) }
  catch (err) { console.error(err instanceof Error ? err.message : 'errore sconosciuto') }
  const ora = new Date().toISOString()
  return (
    <main className="contenitore staff-pagina">
      <header className="staff-barra"><h1 className="heading">Area staff</h1><form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form></header>
      <AggiornamentoAutomatico ogniSecondi={5} ultimoAggiornamento={dati ? ora : undefined} />
      {dati ? <InizioTurno><SchermoStaff ora={ora} tavoli={dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null }))} ordini={dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))} riepiloghi={dati[2]} contiRecenti={dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() }))} /></InizioTurno> : <p role="status" className="staff-nota">Database non raggiungibile, riprovo da solo…</p>}
    </main>
  )
}
