'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { annullaPagamento, registraPagamento, richiestaValida, type Destinazione } from '@/cassa/pagamenti-repo'
import { metodoValido, type MetodoPagamento } from '@/domain/divisione-conto'
import { idValido } from '@/tavoli/validazione'
import { richiediScontrino, risolviIncerto } from '@/fiscale/scontrini-repo'
import type { EsitoStaff } from './azioni'

function destinazione(d: unknown): Destinazione | null {
  if (!d || typeof d !== 'object') return null
  const x = d as Record<string,unknown>
  if (typeof x.sessioneId === 'string' && idValido(x.sessioneId) && !('ordineId' in x)) return { sessioneId: x.sessioneId }
  if (typeof x.ordineId === 'string' && idValido(x.ordineId) && !('sessioneId' in x)) return { ordineId: x.ordineId }
  return null
}
function rivalida() { revalidatePath('/staff'); revalidatePath('/staff/conto/[sessione]','page') }

/**
 * Incassa una parte o tutto il conto. L'importo lo ricalcola il server dal conto aggiornato.
 * Con `scontrino` accoda anche lo scontrino: se quello non parte l'incasso resta, e lo scontrino si rimanda dal conto.
 */
export async function incassa(dest: Destinazione, richiesta: unknown, metodo: MetodoPagamento, scontrino = false): Promise<EsitoStaff> {
  const { userId } = await richiediRuolo('staff')
  const d = destinazione(dest)
  if (!d || !richiestaValida(richiesta) || !metodoValido(metodo) || typeof scontrino !== 'boolean') return { ok: false,errore: 'Pagamento non valido.' }
  let pagamentoId: string
  try {
    const e = await registraPagamento(db,d,richiesta,metodo,userId)
    if (!e.ok) return { ok: false,errore: e.errore }
    pagamentoId = e.pagamento.id
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Incasso non registrato, riprova.' }
  }
  rivalida()
  if (!scontrino) return { ok: true }
  const s = await emettiScontrino(pagamentoId)
  return s.ok ? { ok: true } : { ok: false,errore: `Incasso registrato, ma lo scontrino non è partito: ${s.errore ?? 'riprova dal conto.'}` }
}

/** Accoda lo scontrino di un pagamento al registratore telematico (anche per rimandarlo dopo un errore). */
export async function emettiScontrino(pagamentoId: string): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(pagamentoId)) return { ok: false,errore: 'Pagamento non valido.' }
  try {
    const e = await richiediScontrino(db,pagamentoId)
    if (!e.ok) return { ok: false,errore: e.errore }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Scontrino non accodato, riprova.' }
  }
  rivalida()
  return { ok: true }
}

/** Scontrino incerto: la cassa ha guardato il registratore e dice se è uscito. */
export async function risolviScontrino(pagamentoId: string, uscito: boolean): Promise<EsitoStaff> {
  await richiediRuolo('staff')
  if (!idValido(pagamentoId) || typeof uscito !== 'boolean') return { ok: false,errore: 'Pagamento non valido.' }
  try {
    if (!await risolviIncerto(db,pagamentoId,uscito)) return { ok: false,errore: 'Lo scontrino non è più da controllare: aggiorna la pagina.' }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  rivalida()
  return { ok: true }
}

export async function annullaIncasso(id: string): Promise<EsitoStaff> {
  const { userId } = await richiediRuolo('staff')
  if (!idValido(id)) return { ok: false,errore: 'Pagamento non valido.' }
  try {
    const e = await annullaPagamento(db,id,userId)
    if (e === 'scontrino') return { ok: false,errore: 'Lo scontrino di questo pagamento è uscito o in stampa: si annulla sul registratore, non qui.' }
    if (e !== 'ok') return { ok: false,errore: 'Pagamento già tolto: aggiorna la pagina.' }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Operazione non riuscita, riprova.' }
  }
  rivalida()
  return { ok: true }
}
