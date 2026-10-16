'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { validaCarrello } from '@/domain/carrello'
import { creaOrdineTavolo } from '@/tavoli/ordini-repo'
import { idValido } from '@/tavoli/validazione'
import type { EsitoInvio } from '@/ordinare/esito-invio'
/**
 * Comanda presa dal cameriere per un tavolo aperto: niente cookie né codice del cliente, conta il login dello staff.
 * L'ordine nasce con origine «cameriere» e finisce nella stessa cucina e nello stesso conto degli ordini dei telefoni.
 */
export async function inviaOrdineCameriere(sessioneId: string, carrelloJson: string, chiaveInvio: string): Promise<EsitoInvio> {
  await richiediRuolo('staff')
  if (!idValido(sessioneId)) return { ok: false,errore: 'Il tavolo è stato chiuso: torna ai tavoli.' }
  if (!idValido(chiaveInvio)) return { ok: false,errore: 'Chiave di invio non valida: ricarica il carrello e riprova.' }
  if (typeof carrelloJson !== 'string' || carrelloJson.length > 100000) return { ok: false,errore: 'Carrello non valido.' }
  let input: unknown
  try { input = JSON.parse(carrelloJson) } catch { return { ok: false,errore: 'Carrello non valido: ricarica la pagina e riprova.' } }
  const carrello = validaCarrello(input)
  if (!carrello.ok) return carrello
  try {
    const esito = await creaOrdineTavolo(db,sessioneId,carrello.righe,chiaveInvio,'cameriere')
    if (!esito.ok) return esito
    // Cucina, telefoni del tavolo e conto vedono il nuovo ordine al prossimo aggiornamento.
    revalidatePath('/staff'); revalidatePath('/tavolo/[chiave]','page'); revalidatePath('/staff/conto/[sessione]','page')
    return { ok: true,numero: esito.ordine.numero }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' }
  }
}
