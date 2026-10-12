import { db } from '@/server/db'
import { anonimizzaOrdiniCasa } from '@/casa/ordini-casa-repo'
import { autorizzatoCron } from '@/casa/cron'
export const dynamic = 'force-dynamic'
// Chiamata ogni giorno dal cron di Vercel (vercel.json). Idempotente: una chiamata doppia o saltata non fa danni.
export async function GET(request: Request) {
  if (!autorizzatoCron(request.headers.get('authorization'),process.env.CRON_SECRET)) return new Response('Non autorizzato',{ status: 401 })
  try {
    return Response.json({ anonimizzati: await anonimizzaOrdiniCasa(db,new Date()) },{ headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return Response.json({ errore: 'Anonimizzazione non riuscita' },{ status: 500 })
  }
}
