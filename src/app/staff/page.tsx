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
  const [tavoli,ordini,riepiloghi,conti] = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db)])
  return (
    <main className="contenitore staff-pagina">
      <header className="staff-barra"><h1 className="heading">Area staff</h1><form action={esci}><button className="ds-btn ds-btn--secondary">Esci</button></form></header>
      <AggiornamentoAutomatico ogniSecondi={5} />
      <InizioTurno><SchermoStaff ora={new Date().toISOString()} tavoli={tavoli.map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null }))} ordini={ordini.map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() }))} riepiloghi={riepiloghi} contiRecenti={conti.map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() }))} /></InizioTurno>
    </main>
  )
}
