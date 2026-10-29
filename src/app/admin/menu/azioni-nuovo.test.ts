import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ richiediRuolo: vi.fn(), creaPiatto: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT') }) }))
vi.mock('@/auth/sessione', () => ({ richiediRuolo: m.richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/menu/repo', () => ({ creaPiatto: m.creaPiatto }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
import { creaNuovoPiatto, type StatoModulo } from './azioni'

const INIZIALE: StatoModulo = { salvato: false,errori: {},erroreGenerale: null,valori: null,invii: 0 }
const id = '11111111-1111-4111-8111-111111111111'
function modulo(extra: Record<string,string> = {}) {
  const fd = new FormData()
  for (const [k,v] of Object.entries({ categoriaId: 'vini',numero: '',nome: 'Primitivo',descrizione: '',prezzo: '24',allergeni: 'solfiti',allergeniConfermati: 'on',
    conVino: 'on',vinoTipologia: 'rosso',vinoFormato: 'bottiglia',vinoCantina: '',vinoDenominazione: 'Primitivo di Manduria DOC',vinoAnnata: '2021',...extra })) fd.set(k,v)
  return fd
}
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console,'error').mockImplementation(() => {}); m.richiediRuolo.mockResolvedValue({ userId: 'u',ruolo: 'admin' }); m.redirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT') }) })

it('admin prima del repo; crea il vino con i suoi campi e apre la scheda', async () => {
  m.creaPiatto.mockResolvedValue({ ok: true,id })
  await expect(creaNuovoPiatto(INIZIALE,modulo())).rejects.toThrow('NEXT_REDIRECT')
  expect(m.richiediRuolo).toHaveBeenCalledWith('admin')
  expect(m.richiediRuolo.mock.invocationCallOrder[0]).toBeLessThan(m.creaPiatto.mock.invocationCallOrder[0])
  expect(m.creaPiatto).toHaveBeenCalledWith(expect.anything(),'vini',null,expect.objectContaining({ nome: 'Primitivo',prezzoCent: 2400,allergeni: ['solfiti'],
    vino: { tipologia: 'rosso',formato: 'bottiglia',cantina: null,denominazione: 'Primitivo di Manduria DOC',annata: 2021 } }))
  expect(m.redirect).toHaveBeenCalledWith(`/admin/menu/${id}`)
  expect(m.revalidatePath).toHaveBeenCalledWith('/')
})
it('categoria e numero non validi, numero già usato, errori del DB', async () => {
  expect(await creaNuovoPiatto(INIZIALE,modulo({ categoriaId: '' }))).toMatchObject({ erroreGenerale: 'Scegli la categoria.' })
  expect(await creaNuovoPiatto(INIZIALE,modulo({ numero: '0' }))).toMatchObject({ erroreGenerale: expect.stringContaining('numero') })
  expect(await creaNuovoPiatto(INIZIALE,modulo({ numero: '12a' }))).toMatchObject({ erroreGenerale: expect.stringContaining('numero') })
  expect(await creaNuovoPiatto(INIZIALE,modulo({ vinoTipologia: '' }))).toMatchObject({ errori: { vinoTipologia: expect.any(String) } })
  expect(m.creaPiatto).not.toHaveBeenCalled()
  m.creaPiatto.mockResolvedValueOnce({ ok: false,errore: 'numero' })
  expect(await creaNuovoPiatto(INIZIALE,modulo({ numero: '7' }))).toMatchObject({ erroreGenerale: 'Il numero 7 è già di un altro piatto.',valori: { nome: 'Primitivo' } })
  m.creaPiatto.mockRejectedValueOnce(new Error('giù'))
  expect(await creaNuovoPiatto(INIZIALE,modulo())).toMatchObject({ erroreGenerale: expect.stringContaining('Salvataggio non riuscito') })
  expect(m.redirect).not.toHaveBeenCalled()
})
