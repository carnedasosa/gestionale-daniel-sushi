import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { ModuloCassa, ModuloFiscale } from './ModuloCassa'
import { leggiImpostazioniFiscali, repartiFiscaliCategorie } from '@/fiscale/scontrini-repo'
export default async function CassaAdmin() {
  await richiediRuolo('admin')
  const [impostazioni,fiscali,categorie] = await Promise.all([leggiImpostazioniCassa(db),leggiImpostazioniFiscali(db),repartiFiscaliCategorie(db)])
  return <>
    <div className="b-admin-testa"><div className="b-admin-testa__testi"><h1 className="b-titolo-1">Cassa e stampe</h1>
      <p className="b-secondario">Coperto, stampanti delle comande e registratore telematico.</p></div></div>
    <section className="b-card" aria-labelledby="titolo-coperto"><h2 id="titolo-coperto" className="b-titolo-3">Coperto</h2>
      <p className="b-secondario">Il prezzo vale per i tavoli a cui si segnano i coperti da adesso: quelli già segnati tengono il loro.</p>
      <ModuloCassa impostazioni={impostazioni} /></section>
    <section className="b-card" aria-labelledby="titolo-rt"><h2 id="titolo-rt" className="b-titolo-3">Registratore telematico</h2>
      <p className="b-secondario">Lo scontrino lo emette il registratore del locale, comandato dal ponte di stampa. Oggi il gestionale parla con i registratori Epson (FP-81 II RT, FP-90 III RT).</p>
      <ModuloFiscale impostazioni={fiscali} categorie={categorie} /></section>
  </>
}
