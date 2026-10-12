import type { Email } from '@/domain/email-ordini'
export interface ConfigEmail { apiKey: string; mittente: string; origine: string }
/** Configurazione delle email dall'ambiente; null (email spente) se manca qualcosa o APP_URL non è un URL http(s). */
export function configEmail(env: Record<string,string | undefined>): ConfigEmail | null {
  const apiKey = env.RESEND_API_KEY?.trim(), mittente = env.EMAIL_MITTENTE?.trim()
  if (!apiKey || !mittente || !env.APP_URL?.trim()) return null
  try {
    const url = new URL(env.APP_URL.trim())
    return ['http:','https:'].includes(url.protocol) ? { apiKey,mittente,origine: url.origin } : null
  } catch { return null }
}
export type EsitoInvio = { ok: true } | { ok: false; errore: string }
/** Invio con l'API HTTP di Resend. `idempotenza` evita doppioni se lo stesso invio viene ritentato entro 24 ore. */
export async function inviaConResend(config: ConfigEmail, a: string, email: Email, idempotenza: string, fetchFn: typeof fetch = fetch): Promise<EsitoInvio> {
  try {
    const risposta = await fetchFn('https://api.resend.com/emails',{
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`,'Content-Type': 'application/json','Idempotency-Key': idempotenza },
      body: JSON.stringify({ from: config.mittente,to: [a],subject: email.oggetto,text: email.testo,html: email.html }),
      signal: AbortSignal.timeout(10000),
    })
    if (risposta.ok) return { ok: true }
    return { ok: false,errore: `Resend ${risposta.status}: ${(await risposta.text().catch(() => '')).slice(0,300)}` }
  } catch (err) {
    return { ok: false,errore: err instanceof Error ? err.message.slice(0,300) : 'errore di rete' }
  }
}
