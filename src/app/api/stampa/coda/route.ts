import { db } from '@/server/db'
import { prendiLavori } from '@/stampa/stampe-repo'
import { autorizzatoPonte, perIlPonte } from '@/stampa/ponte'
export const dynamic = 'force-dynamic'

// Il ponte di stampa del locale chiede lavoro ogni 2 secondi. Ogni chiamata è anche il suo segnale di vita.
export async function GET(request: Request) {
  if (!process.env.STAMPA_TOKEN) return new Response('Stampa non configurata',{ status: 503 })
  if (!autorizzatoPonte(request.headers.get('authorization'),process.env.STAMPA_TOKEN)) return new Response('Non autorizzato',{ status: 401 })
  try {
    const lavori = await prendiLavori(db)
    return Response.json({ lavori: lavori.map(perIlPonte) },{ headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return Response.json({ errore: 'Coda non disponibile' },{ status: 500 })
  }
}
