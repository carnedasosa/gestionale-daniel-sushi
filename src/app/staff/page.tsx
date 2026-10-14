import { unstable_rethrow } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import { db } from '@/server/db'
import { elencoTavoli, contiRecenti } from '@/tavoli/repo'
import { ordiniAttivi, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { ordiniCasaAttivi, perClient } from '@/casa/ordini-casa-repo'
import { leggiDisponibilita } from '@/casa/disponibilita'
import { avviaInvioEmail } from '@/casa/avvia-email'
import { modalitaProva, TESTO_MOTIVO, type StatoApertura } from '@/domain/apertura-casa'
import { InizioTurno } from './InizioTurno'
import { SchermoStaff } from './SchermoStaff'
import { vistaStaff } from './vista'
import './staff.css'

export default async function AreaStaff({ searchParams }: { searchParams?: Promise<{ vista?: string }> } = {}) {
  const vista = vistaStaff((await searchParams)?.vista)
  let dati = null
  try {
    // Anche il ruolo si legge dal DB: se il DB non risponde lo schermo resta montato con gli ultimi
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db),ordiniCasaAttivi(db),leggiDisponibilita(db,new Date(),modalitaProva(process.env))])
    // Ogni aggiornamento dello schermo ritenta anche le email rimaste in coda.
    avviaInvioEmail()
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
  const ora = new Date().toISOString()
  const motivo = (a: StatoApertura) => a.aperto ? null : TESTO_MOTIVO[a.motivo]
  const datiStaff = dati ? {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
    casa: dati[4].map(perClient),
    ordiniOnline: { accesi: dati[5].apertiIl === dati[5].oggi,asporto: motivo(dati[5].servizi.asporto.apertura),domicilio: motivo(dati[5].servizi.domicilio.apertura) },
  } : null
  const uscita = <form action={esci}><button className="b-btn b-btn--discreto">Esci</button></form>
  return (
    <main className="b-staff">
      <h1 className="b-nascosto">Area staff</h1>
      <AggiornamentoAutomatico ogniSecondi={5} ultimoAggiornamento={dati ? ora : undefined} />
      {!dati && <p role="status" className="b-avviso b-avviso--accettare b-staff__avviso">Database non raggiungibile, riprovo da solo… Lo schermo mostra gli ultimi dati ricevuti.</p>}
      {/* Sempre montati, anche se la lettura fallisce: suono e ordini già visti non si perdono. */}
      <InizioTurno uscita={uscita}><SchermoStaff ora={ora} dati={datiStaff} vista={vista} uscita={uscita} /></InizioTurno>
    </main>
  )
}
