import { afterEach, expect, it, vi } from 'vitest'
import { prossimoStatoConnessione, verificaConnessione } from './connessione'
afterEach(() => { vi.useRealTimers() })
it('mantiene l’ultimo aggiornamento quando cade la rete e lo aggiorna solo su successo', () => {
  const s = { offline: false,ultimoAggiornamento: '2026-10-11T19:00:00Z' }
  const offline = prossimoStatoConnessione(s,false,'2026-10-11T19:01:00Z')
  expect(offline).toEqual({ ...s,offline: true })
  expect(prossimoStatoConnessione(offline,true,'2026-10-11T19:02:00Z')).toEqual({ offline: false,ultimoAggiornamento: '2026-10-11T19:02:00Z' })
})
it('probe senza cache: solo 204 è successo, errori e timeout non autorizzano il refresh', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null,{ status: 204 }))
  expect(await verificaConnessione(fetcher)).toBe(true)
  expect(fetcher).toHaveBeenCalledWith('/stato',expect.objectContaining({ cache: 'no-store',signal: expect.any(AbortSignal) }))
  fetcher.mockResolvedValueOnce(new Response(null,{ status: 503 }))
  expect(await verificaConnessione(fetcher)).toBe(false)
  fetcher.mockRejectedValueOnce(new Error('offline'))
  expect(await verificaConnessione(fetcher)).toBe(false)
  vi.useFakeTimers()
  const attesa = verificaConnessione((_url,init) => new Promise((_resolve,reject) => init!.signal!.addEventListener('abort',() => reject(new Error('timeout')))))
  await vi.advanceTimersByTimeAsync(4000)
  expect(await attesa).toBe(false)
})
