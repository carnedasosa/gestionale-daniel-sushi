import { db } from '@/server/db'
import { registraEsitoPonte } from '@/fiscale/scontrini-repo'
import { autorizzatoPonte, esitoValido } from '@/stampa/ponte'
export const dynamic = 'force-dynamic'

// Il ponte riporta com'è andato un lavoro preso dalla coda.
export async function POST(request: Request) {
  if (!process.env.STAMPA_TOKEN) return new Response('Stampa non configurata',{ status: 503 })
  if (!autorizzatoPonte(request.headers.get('authorization'),process.env.STAMPA_TOKEN)) return new Response('Non autorizzato',{ status: 401 })
  let corpo: unknown
  try { corpo = await request.json() } catch { return Response.json({ errore: 'Corpo non valido' },{ status: 400 }) }
  if (!esitoValido(corpo)) return Response.json({ errore: 'Esito non valido' },{ status: 400 })
  try {
    const registrato = await registraEsitoPonte(db,corpo)
    return Response.json({ registrato },{ headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return Response.json({ errore: 'Esito non registrato' },{ status: 500 })
  }
}
