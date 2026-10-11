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
