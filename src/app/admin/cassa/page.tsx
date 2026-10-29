import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { leggiImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { ModuloCassa } from './ModuloCassa'
export default async function CassaAdmin() {
  await richiediRuolo('admin')
  const impostazioni = await leggiImpostazioniCassa(db)
  return <>
    <div className="b-admin-testa"><div className="b-admin-testa__testi"><h1 className="b-titolo-1">Cassa e stampe</h1>
      <p className="b-secondario">Coperto, stampanti delle comande e registratore telematico.</p></div></div>
    <section className="b-card" aria-labelledby="titolo-coperto"><h2 id="titolo-coperto" className="b-titolo-3">Coperto</h2>
      <p className="b-secondario">Il prezzo vale per i tavoli a cui si segnano i coperti da adesso: quelli già segnati tengono il loro.</p>
      <ModuloCassa impostazioni={impostazioni} /></section>
  </>
}
