// Nel progetto non c'è un DOM per i test (né jsdom né happy-dom): si prova `eseguiAzione`, la logica dell'hook
// `useEsegui` senza React; l'hook si limita a collegarla a useState/useRef e a router.refresh().
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import type { EsitoStaff } from './azioni'
import { eseguiAzione, type EffettiEsegui } from './useEsegui'

function promessa<T>() {
  let risolvi!: (v: T) => void, rifiuta!: (e: unknown) => void
  const p = new Promise<T>((ok,ko) => { risolvi = ok; rifiuta = ko })
  return { p,risolvi,rifiuta }
}
// Simula lo stato React: l'ultimo insieme di chiavi in volo e l'ultimo errore mostrato.
function schermo() {
  const stato = { inVolo: new Set<string>() as ReadonlySet<string>,errore: null as string | null }
  const aggiorna = vi.fn()
  const effetti: EffettiEsegui = { inVolo: c => { stato.inVolo = c },errore: m => { stato.errore = m },aggiorna }
  const bloccate = new Set<string>()
  const esegui = (chiave: string,azione: () => Promise<EsitoStaff>) => eseguiAzione(chiave,azione,bloccate,effetti)
  return { stato,aggiorna,esegui }
}
const attendi = () => new Promise(r => setTimeout(r,0))

describe('eseguiAzione (logica di useEsegui)', () => {
  it('mentre l’azione della card A è in volo, A è in corso e B no; B parte lo stesso', async () => {
    const s = schermo(), a = promessa<EsitoStaff>(), b = promessa<EsitoStaff>()
    const azioneB = vi.fn(() => b.p)
    s.esegui('ordine:A',() => a.p)
    expect(s.stato.inVolo.has('ordine:A')).toBe(true); expect(s.stato.inVolo.has('ordine:B')).toBe(false)
    s.esegui('ordine:B',azioneB)
    expect(azioneB).toHaveBeenCalledTimes(1); expect([...s.stato.inVolo]).toEqual(['ordine:A','ordine:B'])
    b.risolvi({ ok: true }); await attendi()
    expect([...s.stato.inVolo]).toEqual(['ordine:A'])
    a.risolvi({ ok: true }); await attendi()
    expect(s.stato.inVolo.size).toBe(0)
  })

  it('un secondo tocco sulla stessa card mentre l’azione è in volo non la richiama; finita, si può rifare', async () => {
    const s = schermo(), a = promessa<EsitoStaff>()
    const azione = vi.fn(() => a.p)
    s.esegui('comanda:1',azione); s.esegui('comanda:1',azione)
    expect(azione).toHaveBeenCalledTimes(1)
    a.risolvi({ ok: true }); await attendi()
    s.esegui('comanda:1',vi.fn(async () => ({ ok: true })))
    expect(s.stato.inVolo.has('comanda:1')).toBe(true)
  })

  it('risolta l’azione la card torna libera e poi si aggiorna lo schermo, senza aspettare l’aggiornamento', async () => {
    const s = schermo(), a = promessa<EsitoStaff>()
    // Aggiornamento che non finisce mai (rete appesa): la card deve tornare libera lo stesso.
    let liberaQuandoAggiorna: boolean | null = null
    s.aggiorna.mockImplementation(() => { liberaQuandoAggiorna = !s.stato.inVolo.has('tavolo:1'); return new Promise(() => {}) })
    s.esegui('tavolo:1',() => a.p)
    expect(s.aggiorna).not.toHaveBeenCalled()
    a.risolvi({ ok: true }); await attendi()
    expect(s.aggiorna).toHaveBeenCalledTimes(1); expect(liberaQuandoAggiorna).toBe(true)
    expect(s.stato.inVolo.has('tavolo:1')).toBe(false); expect(s.stato.errore).toBeNull()
  })

  it('un esito { ok: false } mostra l’errore e aggiorna comunque; un nuovo tocco lo cancella', async () => {
    const s = schermo()
    s.esegui('casa:1',async () => ({ ok: false,errore: 'Ordine già accettato.' })); await attendi()
    expect(s.stato.errore).toBe('Ordine già accettato.'); expect(s.aggiorna).toHaveBeenCalledTimes(1)
    s.esegui('casa:2',() => new Promise(() => {}))
    expect(s.stato.errore).toBeNull()
  })

  it('senza messaggio o con un’eccezione mostra l’errore generico, libera la card e aggiorna', async () => {
    const s = schermo()
    s.esegui('a',async () => ({ ok: false })); await attendi()
    expect(s.stato.errore).toBe('Operazione non riuscita, riprova.')
    s.esegui('b',async () => { throw new Error('rete') }); await attendi()
    expect(s.stato.errore).toBe('Operazione non riuscita, riprova.'); expect(s.stato.inVolo.size).toBe(0)
    expect(s.aggiorna).toHaveBeenCalledTimes(2)
  })
})
