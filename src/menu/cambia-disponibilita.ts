import 'server-only'
import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { impostaDisponibile } from './repo'

export type EsitoDisponibilita = { ok: true } | { ok: false; errore: string }

/**
 * Segna un piatto disponibile o esaurito, per l'admin e per lo staff (il ruolo lo controlla l'azione che chiama).
 * Rivalida menù dei clienti, admin e schermo staff: tutti vedono subito lo stato nuovo.
 */
export async function cambiaDisponibilitaPiatto(id: string, disponibile: boolean): Promise<EsitoDisponibilita> {
  if (typeof id !== 'string' || typeof disponibile !== 'boolean') return { ok: false, errore: 'Piatto non valido.' }
  let trovato: boolean
  try {
    trovato = await impostaDisponibile(db, id, disponibile)
  } catch (err) {
    // Solo il messaggio, mai variabili d'ambiente: la stringa di connessione contiene la password.
    console.error('cambiaDisponibilita non riuscito:', err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false, errore: 'Salvataggio non riuscito: controlla la connessione e riprova.' }
  }
  // Anche se il piatto non esiste più si rivalida: la pagina mostra lo stato reale.
  revalidatePath('/admin/menu')
  revalidatePath('/staff')
  revalidatePath('/')
  return trovato ? { ok: true } : { ok: false, errore: 'Piatto non trovato: forse è stato eliminato.' }
}
