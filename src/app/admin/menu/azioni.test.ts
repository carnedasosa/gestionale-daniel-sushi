import { beforeEach, describe, expect, it, vi } from 'vitest'

const { richiediRuolo, aggiornaPiatto, impostaDisponibile, revalidatePath } = vi.hoisted(() => ({
  richiediRuolo: vi.fn(),
  aggiornaPiatto: vi.fn(),
  impostaDisponibile: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/auth/sessione', () => ({ richiediRuolo }))
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('@/menu/repo', () => ({ aggiornaPiatto, impostaDisponibile }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { cambiaDisponibilita, salvaPiatto, type StatoModulo } from './azioni'

const INIZIALE: StatoModulo = { salvato: false, errori: {}, erroreGenerale: null, valori: null, invii: 3 }

function modulo(): FormData {
  const fd = new FormData()
  fd.set('nome', 'Salmone')
  fd.set('descrizione', '')
  fd.set('prezzo', '2,00')
  return fd
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('salvaPiatto', () => {
  it('se il database fallisce restituisce un errore in italiano e i valori inviati', async () => {
    aggiornaPiatto.mockRejectedValue(new Error('connessione scaduta'))
    const stato = await salvaPiatto('id', INIZIALE, modulo())
    expect(stato.salvato).toBe(false)
    expect(stato.erroreGenerale).toBe('Salvataggio non riuscito: controlla la connessione e riprova.')
    expect(stato.valori?.nome).toBe('Salmone')
    expect(stato.invii).toBe(4)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('non intercetta il redirect di richiediRuolo', async () => {
    richiediRuolo.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(salvaPiatto('id', INIZIALE, modulo())).rejects.toThrow('NEXT_REDIRECT')
    expect(aggiornaPiatto).not.toHaveBeenCalled()
  })
})

describe('cambiaDisponibilita', () => {
  it('solo admin: il ruolo si controlla prima di scrivere', async () => {
    impostaDisponibile.mockResolvedValue(true)
    expect(await cambiaDisponibilita('id', false)).toEqual({ ok: true })
    expect(richiediRuolo).toHaveBeenCalledWith('admin')
    expect(impostaDisponibile).toHaveBeenCalledWith({}, 'id', false)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/menu')
    expect(revalidatePath).toHaveBeenCalledWith('/staff')
  })
  it('se il database fallisce restituisce l’errore da mostrare e non rivalida', async () => {
    impostaDisponibile.mockRejectedValue(new Error('connessione scaduta'))
    expect(await cambiaDisponibilita('id', false)).toEqual({ ok: false, errore: 'Salvataggio non riuscito: controlla la connessione e riprova.' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('se il piatto non esiste più lo dice e rivalida comunque', async () => {
    impostaDisponibile.mockResolvedValue(false)
    expect(await cambiaDisponibilita('id', false)).toEqual({ ok: false, errore: 'Piatto non trovato: forse è stato eliminato.' })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/menu')
  })
  it('rifiuta valori non booleani senza toccare il database', async () => {
    expect((await cambiaDisponibilita('id', 'no' as unknown as boolean)).ok).toBe(false)
    expect(impostaDisponibile).not.toHaveBeenCalled()
  })
})
