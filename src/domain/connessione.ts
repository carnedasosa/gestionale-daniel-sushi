export interface StatoConnessione { offline: boolean; ultimoAggiornamento: string | null }
export function prossimoStatoConnessione(s: StatoConnessione,riuscito: boolean,ora: string | null): StatoConnessione {
  return riuscito ? { offline: false,ultimoAggiornamento: ora ?? s.ultimoAggiornamento } : { ...s,offline: true }
}
export async function verificaConnessione(fetcher: (url: string,init: RequestInit) => Promise<Response> = fetch,signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false
  const controller = new AbortController()
  const interrompi = () => controller.abort()
  signal?.addEventListener('abort',interrompi,{ once: true })
  const timeout = setTimeout(interrompi,4000)
  try { return (await fetcher('/stato',{ cache: 'no-store',signal: controller.signal })).status===204 }
  catch { return false }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort',interrompi) }
}
// Un aggiornamento della pagina ancora in corso blocca il successivo, ma non per sempre:
// se dopo 30 secondi non è finito si riprova comunque.
export const ATTESA_MASSIMA_AGGIORNAMENTO_MS = 30_000
export function puoAggiornare(inizioInCorso: number | null, ora: number): boolean {
  return inizioInCorso === null || ora - inizioInCorso >= ATTESA_MASSIMA_AGGIORNAMENTO_MS
}
