import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

// La fine della scrittura non si può provocare con un socket vero: un PC Windows dà per scritti anche 64 MB a chi non legge.
// Quindi qui il socket è finto, e si controlla cosa fa inviaTcp a ogni evento.
const m = vi.hoisted(() => ({ socket: null as unknown as EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> } }))
vi.mock('node:net',() => ({ createConnection: () => m.socket }))
import { inviaTcp } from './trasporto'

beforeEach(() => {
  vi.useFakeTimers()
  m.socket = Object.assign(new EventEmitter(),{ end: vi.fn(),destroy: vi.fn(),resume: vi.fn() })
})
afterEach(() => { vi.useRealTimers() })
const invia = () => inviaTcp('stampante',9100,Buffer.from('x'),3000)

it('i byte partiti bastano: non serve che la stampante chiuda', async () => {
  const p = invia()
  m.socket.emit('connect')
  expect(m.socket.end).toHaveBeenCalledWith(Buffer.from('x'))
  m.socket.emit('finish')
  await expect(p).resolves.toBeUndefined()
  expect(m.socket.destroy).not.toHaveBeenCalled()
})
it('dopo la scrittura il tempo scaduto o un errore non cambiano l’esito, e il socket non resta aperto', async () => {
  const p = invia()
  m.socket.emit('connect'); m.socket.emit('finish')
  await vi.advanceTimersByTimeAsync(3000)
  expect(m.socket.destroy).toHaveBeenCalled()
  m.socket.emit('error',new Error('ECONNRESET'))
  await expect(p).resolves.toBeUndefined()
})
it('tempo scaduto prima della connessione o a metà scrittura: errore', async () => {
  const senzaConnessione = invia()
  const atteso = expect(senzaConnessione).rejects.toThrow('non risponde')
  await vi.advanceTimersByTimeAsync(3000)
  await atteso
  expect(m.socket.destroy).toHaveBeenCalled()

  m.socket = Object.assign(new EventEmitter(),{ end: vi.fn(),destroy: vi.fn(),resume: vi.fn() })
  const aMeta = invia()
  m.socket.emit('connect')
  const attesoAMeta = expect(aMeta).rejects.toThrow('non risponde')
  await vi.advanceTimersByTimeAsync(3000)
  await attesoAMeta
})
it('connessione che si rompe o si chiude prima della fine della scrittura: errore', async () => {
  const rotta = invia()
  m.socket.emit('connect'); m.socket.emit('error',new Error('EPIPE'))
  await expect(rotta).rejects.toThrow('EPIPE')

  m.socket = Object.assign(new EventEmitter(),{ end: vi.fn(),destroy: vi.fn(),resume: vi.fn() })
  const chiusa = invia()
  m.socket.emit('connect'); m.socket.emit('close')
  await expect(chiusa).rejects.toThrow('prima della fine')
})
it('legge quello che la stampante manda indietro, altrimenti il socket non si chiude', () => {
  void invia()
  expect(m.socket.resume).toHaveBeenCalled()
})
