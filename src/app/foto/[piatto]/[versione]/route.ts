import { db } from '@/server/db'
import { leggiFoto } from '@/menu/foto-repo'

// Pubbliche come il menù. La versione nell'indirizzo cambia a ogni foto nuova: la cache può tenerla per un anno.
export async function GET(_: Request, { params }: { params: Promise<{ piatto: string; versione: string }> }) {
  const { piatto,versione } = await params
  let foto: Awaited<ReturnType<typeof leggiFoto>>
  try { foto = await leggiFoto(db,piatto,versione) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return new Response('Foto non disponibile',{ status: 503,headers: { 'Cache-Control': 'no-store' } })
  }
  if (!foto) return new Response('Foto non trovata',{ status: 404,headers: { 'Cache-Control': 'public, max-age=60' } })
  return new Response(new Uint8Array(foto.dati),{ headers: { 'Content-Type': foto.tipo,'Cache-Control': 'public, max-age=31536000, immutable','X-Content-Type-Options': 'nosniff' } })
}
