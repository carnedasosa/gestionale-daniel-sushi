'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { annullaPagamento, registraPagamento, richiestaValida, type Destinazione } from '@/cassa/pagamenti-repo'
import { metodoValido, type MetodoPagamento } from '@/domain/divisione-conto'
import { idValido } from '@/tavoli/validazione'
import type { EsitoStaff } from './azioni'

function destinazione(d: unknown): Destinazione | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Record<string,unknown>
  if (typeof x.sessioneId === 'string' && idValido(x.sessioneId) && !('ordineId' in x)) return { sessioneId: x.sessioneId }
  if (typeof x.ordineId === 'string' && idValido(x.ordineId) && !('sessioneId' in x)) return { ordineId: x.ordineId }
  return null
}
function rivalida() { revalidatePath('/staff'); revalidatePath('/staff/conto/[sessione]','page') }

/** Incassa una parte o tutto il conto. L'importo lo ricalcola il server dal conto aggiornato. */
export async function incassa(dest: Destinazione, richiesta: unknown, metodo: MetodoPagamento): Promise<EsitoStaff> {
  const { userId } = await richiediRuolo('staff')
  const d = destinazione(dest)
  if (!d || !richiestaValida(richiesta) || !metodoValido(metodo)) return { ok: false,errore: 'Pagamento non valido.' }
  try {
    const e = await registraPagamento(db,d,richiesta,metodo,userId)
    if (!e.ok) return { ok: false,errore: e.errore }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Incasso non registrato, riprova.' }
  }
  rivalida()
  return { ok: true }
}

export async function annullaIncasso(id: string): Promise<EsitoStaff> {
  const { userId } = await richiediRuolo('staff')
  if (!idValido(id)) return { ok: false,errore: 'Pagamento non valido.' }
  try {
    if (await annullaPagamento(db,id,userId) !== 'ok') return { ok: false,errore: 'Pagamento già tolto: aggiorna la pagina.' }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  rivalida()
  return { ok: true }
}
