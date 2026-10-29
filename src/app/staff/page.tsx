import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { richiediRuolo } from '@/auth/sessione'
import { esci } from '@/app/accesso/azioni'
import { db } from '@/server/db'
import { elencoTavoli, contiRecenti } from '@/tavoli/repo'
import { ordiniAttivi, riepiloghiTavoli } from '@/tavoli/ordini-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { ordiniCasaAttivi, perClient } from '@/casa/ordini-casa-repo'
import { leggiDisponibilita } from '@/casa/disponibilita'
import { leggiMenu, type CategoriaConPiatti } from '@/menu/repo'
import { avviaInvioEmail } from '@/casa/avvia-email'
import { comandaPerClient, comandeAttive, daPortare, riepilogoComande } from '@/comande/comande-repo'
import { modalitaProva, TESTO_MOTIVO, type StatoApertura } from '@/domain/apertura-casa'
import { COOKIE_POSTAZIONE, postazioneDa, repartoDellaPostazione } from '@/domain/postazioni'
import { InizioTurno } from './InizioTurno'
import { SchermoStaff, type DatiStaff } from './SchermoStaff'
import { SchermoReparto, type DatiReparto } from './SchermoReparto'
import { vistaStaff } from './vista'
import { statoCoda } from '@/stampa/stampe-repo'
import { allarmeStampa } from '@/stampa/instradamento'
import { leggiImpostazioniCassa } from '@/cassa/impostazioni-repo'
import './staff.css'

// Il menù serve solo alla scheda «Menù»: le altre non lo rileggono a ogni aggiornamento.
const menuPerClient = (menu: CategoriaConPiatti[] | null) => menu?.map(c => ({ id: c.id,nome: c.nome,pezzi: c.pezzi,piatti: c.piatti.map(p => ({ id: p.id,numero: p.numero,nome: p.nome,prezzoCent: p.prezzoCent,allergeniConfermati: p.allergeniConfermati,disponibile: p.disponibile })) })) ?? null

async function leggiCassa(vista: string): Promise<DatiStaff> {
  const dati = await Promise.all([elencoTavoli(db),ordiniAttivi(db),riepiloghiTavoli(db),contiRecenti(db),ordiniCasaAttivi(db),leggiDisponibilita(db,new Date(),modalitaProva(process.env)),
    vista === 'menu' ? leggiMenu(db) : null,daPortare(db),statoCoda(db),leggiImpostazioniCassa(db)])
  const usata = Object.values(dati[9].stampa).some(Boolean)
  const comande = await riepilogoComande(db,[...dati[1],...dati[4]].map(o => o.id))
  const motivo = (a: StatoApertura) => a.aperto ? null : TESTO_MOTIVO[a.motivo]
  return {
    tavoli: dati[0].map(t => ({ ...t,sessione: t.sessione ? { ...t.sessione,apertaIl: t.sessione.apertaIl.toISOString() } : null })),
    ordini: dati[1].map(o => ({ ...o,creatoIl: o.creatoIl.toISOString() })),
    riepiloghi: dati[2],
    contiRecenti: dati[3].map(c => ({ ...c,chiusaIl: c.chiusaIl.toISOString() })),
    casa: dati[4].map(perClient),
    menu: menuPerClient(dati[6]),
    ordiniOnline: { accesi: dati[5].apertiIl === dati[5].oggi,asporto: motivo(dati[5].servizi.asporto.apertura),domicilio: motivo(dati[5].servizi.domicilio.apertura) },
    daPortare: dati[7].map(v => ({ ...v,quando: new Date(v.quando).toISOString() })),
    comande: Object.fromEntries(comande),
    stampa: { usata,allarme: allarmeStampa(dati[8],usata,new Date()) },
  }
}

export default async function AreaStaff({ searchParams }: { searchParams?: Promise<{ vista?: string; postazione?: string }> } = {}) {
  const query = await searchParams
  const postazione = postazioneDa(query?.postazione,(await cookies()).get(COOKIE_POSTAZIONE)?.value)
  const reparto = repartoDellaPostazione(postazione)
  const vista = vistaStaff(query?.vista,postazione)
  let cassa: DatiStaff | null = null, repartoDati: DatiReparto | null = null
  try {
    // Anche il ruolo si legge dal DB: se il DB non risponde lo schermo resta montato con gli ultimi
    // dati del browser invece di passare alla pagina d'errore. I redirect di accesso e permessi
    // passano comunque (unstable_rethrow) e senza ruolo verificato non si legge alcun dato.
    await richiediRuolo('staff')
    // Banco e cucina leggono solo le proprie comande: niente tavoli, conti e ordini da accettare.
    if (reparto) {
      const [comande,menu] = await Promise.all([comandeAttive(db,reparto),vista === 'menu' ? leggiMenu(db) : null])
      repartoDati = { comande: comande.map(comandaPerClient),menu: menuPerClient(menu) }
    } else cassa = await leggiCassa(vista)
    // Ogni aggiornamento dello schermo ritenta anche le email rimaste in coda.
    avviaInvioEmail()
  } catch (err) {
    unstable_rethrow(err)
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
  }
  const letti = cassa !== null || repartoDati !== null
  const ora = new Date().toISOString()
  const uscita = <form action={esci}><button className="b-btn b-btn--discreto">Esci</button></form>
  return (
    <main className="b-staff">
      <h1 className="b-nascosto">Area staff</h1>
      <AggiornamentoAutomatico ogniSecondi={5} ultimoAggiornamento={letti ? ora : undefined} />
      {!letti && <p role="status" className="b-avviso b-avviso--accettare b-staff__avviso">Database non raggiungibile, riprovo da solo… Lo schermo mostra gli ultimi dati ricevuti.</p>}
      {/* Sempre montati, anche se la lettura fallisce: suono e ordini già visti non si perdono. */}
      <InizioTurno uscita={uscita} postazione={postazione}>
        {reparto ? <SchermoReparto key={postazione} postazione={reparto} ora={ora} dati={repartoDati} vista={vista} uscita={uscita} />
          : <SchermoStaff key={postazione} postazione={postazione === 'sala' ? 'sala' : 'cassa'} ora={ora} dati={cassa} vista={vista} uscita={uscita} />}
      </InizioTurno>
    </main>
  )
}
