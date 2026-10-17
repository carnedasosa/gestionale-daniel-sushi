import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ creaOrdineCasa: vi.fn(), avviaInvioEmail: vi.fn() }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/casa/ordini-casa-repo', () => ({ creaOrdineCasa: m.creaOrdineCasa }))
vi.mock('@/casa/avvia-email', () => ({ avviaInvioEmail: m.avviaInvioEmail }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '192.0.2.1' }) }))
import { inviaOrdineCasa } from './azioni'
const piatto = '11111111-1111-4111-8111-111111111111', chiaveInvio = '33333333-3333-4333-8333-333333333333'
const dati = { tipo: 'asporto',fascia: '2026-10-12T16:30:00.000Z',nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',privacy: true }
const corpo = (diverso: Record<string,unknown> = {}) => JSON.stringify({ righe: [{ piattoId: piatto,quantita: 2,nota: '' }],dati,totaleVistoCent: 1200,chiaveInvio,...diverso })
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}) })
it('invio riuscito: dati normalizzati, rete del client, email avviate', async () => {
  m.creaOrdineCasa.mockResolvedValue({ ok: true,ordine: { token: 't'.repeat(32),numero: 4807,numeroGiorno: 7 } })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: true,token: 't'.repeat(32),numero: 7 })
  expect(m.creaOrdineCasa).toHaveBeenCalledWith({},expect.objectContaining({ totaleVistoCent: 1200,chiaveInvio,rete: '192.0.2.1',prova: false,dati: expect.objectContaining({ fascia: new Date(dati.fascia) }) }))
  expect(m.avviaInvioEmail).toHaveBeenCalledTimes(1)
})
it('JSON rotto, dati sbagliati e carrello vuoto non arrivano al repository', async () => {
  expect(await inviaOrdineCasa('{')).toMatchObject({ ok: false })
  expect(await inviaOrdineCasa(corpo({ dati: { ...dati,telefono: '1',privacy: false } }))).toMatchObject({ ok: false,errori: { telefono: expect.any(String),privacy: expect.any(String) } })
  expect(await inviaOrdineCasa(corpo({ righe: [] }))).toMatchObject({ ok: false })
  expect(await inviaOrdineCasa('x'.repeat(100001))).toMatchObject({ ok: false })
  expect(m.creaOrdineCasa).not.toHaveBeenCalled()
})
it('errori del repository: campo evidenziato, fasce rimaste, nuovo totale; niente email', async () => {
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'L’orario scelto non è più disponibile: scegline un altro.',campo: 'fascia',fasce: ['2026-10-12T16:45:00.000Z'] })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'L’orario scelto non è più disponibile: scegline un altro.',fasce: ['2026-10-12T16:45:00.000Z'],errori: { fascia: 'L’orario scelto non è più disponibile: scegline un altro.' } })
  m.creaOrdineCasa.mockResolvedValueOnce({ ok: false,errore: 'I prezzi sono cambiati',campo: 'carrello',totaleCent: 1400 })
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'I prezzi sono cambiati',totaleCent: 1400 })
  expect(m.avviaInvioEmail).not.toHaveBeenCalled()
})
it('errore del database: messaggio italiano che invita a riprovare senza paura di doppioni', async () => {
  m.creaOrdineCasa.mockRejectedValueOnce(new Error('connessione'))
  expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'Non siamo sicuri che l’ordine sia arrivato. Riprova: se era già arrivato non verrà duplicato.' })
})
it('lock o istruzione scaduti: messaggio «sistema occupato», niente email', async () => {
  for (const code of ['55P03','57014']) {
    m.creaOrdineCasa.mockRejectedValueOnce(Object.assign(new Error('canceling statement due to timeout'),{ code }))
    expect(await inviaOrdineCasa(corpo())).toEqual({ ok: false,errore: 'Il sistema è occupato, riprova tra qualche secondo: se l’ordine era già arrivato non verrà duplicato.' })
  }
  expect(m.avviaInvioEmail).not.toHaveBeenCalled()
})
