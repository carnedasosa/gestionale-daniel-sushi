import { db } from '@/server/db'
import { anonimizzaOrdiniCasa, azzeraRetiVecchie } from '@/casa/ordini-casa-repo'
import { eliminaTentativiVecchi } from '@/tavoli/repo'
import { autorizzatoCron } from '@/casa/cron'
export const dynamic = 'force-dynamic'
// Chiamata ogni giorno alle 3 dal cron di Vercel (vercel.json). Idempotente: una chiamata doppia o saltata non fa danni.
// Le tre pulizie girano in sequenza nello stesso try, ognuna nella propria istruzione o transazione: se una fallisce
// quelle già fatte restano, le successive saltano e si rifanno la notte dopo (sono tutte idempotenti), con un 500
// che la segnala nei log di Vercel.
export async function GET(request: Request) {
  if (!autorizzatoCron(request.headers.get('authorization'),process.env.CRON_SECRET)) return new Response('Non autorizzato',{ status: 401 })
  try {
    const adesso = new Date()
    const risultato = {
      anonimizzati: await anonimizzaOrdiniCasa(db,adesso),
      retiAzzerate: await azzeraRetiVecchie(db,adesso),
      tentativiEliminati: await eliminaTentativiVecchi(db,adesso),
    }
    return Response.json(risultato,{ headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return Response.json({ errore: 'Anonimizzazione non riuscita' },{ status: 500 })
  }
}
