import { notFound } from 'next/navigation'
import { db } from '@/server/db'
import { ordineCasaPerToken, perClient } from '@/casa/ordini-casa-repo'
import { leggiImpostazioni } from '@/casa/impostazioni-repo'
import { AggiornamentoAutomatico } from '@/componenti/AggiornamentoAutomatico'
import { RicordaOrdine } from '../../OrdineInCorso'
import { StatoOrdine, ordineConcluso } from './StatoOrdine'
import '@/app/tavolo/[chiave]/tavolo.css'
import '../../casa.css'
export default async function PaginaStatoOrdine({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ordine = await ordineCasaPerToken(db,token)
  if (!ordine) notFound()
  const { telefono } = await leggiImpostazioni(db)
  const ora = new Date().toISOString(), concluso = ordineConcluso(ordine.stato)
  return <main className="contenitore casa-pagina">
    {!concluso && <><AggiornamentoAutomatico ogniSecondi={10} ultimoAggiornamento={ora} /><RicordaOrdine token={ordine.token} numero={ordine.numero} /></>}
    <StatoOrdine ordine={perClient(ordine)} telefono={telefono} ora={ora} />
  </main>
}
