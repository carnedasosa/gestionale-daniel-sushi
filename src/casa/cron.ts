import { timingSafeEqual } from 'node:crypto'
/** Vercel invia `Authorization: Bearer <CRON_SECRET>`. Senza un segreto di almeno 16 caratteri non passa nessuno. */
export function autorizzatoCron(intestazione: string | null, segreto: string | undefined): boolean {
  if (!segreto || segreto.length < 16 || !intestazione) return false
  const atteso = Buffer.from(`Bearer ${segreto}`), ricevuto = Buffer.from(intestazione)
  return atteso.length === ricevuto.length && timingSafeEqual(atteso,ricevuto)
}
