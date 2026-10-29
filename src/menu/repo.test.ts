import { beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import type { Db } from '@/server/db-tipi'
import { aggiornaPiatto, aggiornaRepartoCategoria, contaAllergeniDaConfermare, impostaDisponibile, leggiMenu, leggiPiatto, type DatiPiatto } from './repo'

let db: Db
beforeEach(async () => {
  ;({ db } = await creaDbDiTest({ seed: true }))
})

async function idDi(numero: number): Promise<string> {
  const [r] = await db.query<{ id: string }>('select id from piatti where numero = $1', [numero])
  return r.id
}

const dati: DatiPiatto = {
  nome: 'Salmone', descrizione: 'Riso e salmone', prezzoCent: 250,
  piccante: false, vegetariano: false, dellaCasa: true,
  allergeni: ['pesce', 'soia'], allergeniConfermati: true,
}

describe('leggiMenu', () => {
  it('categorie in ordine con i loro piatti in ordine', async () => {
    const menu = await leggiMenu(db)
    expect(menu).toHaveLength(15)
    expect(menu[0].id).toBe('tartare')
    expect(menu.at(-1)).toMatchObject({ id: 'vini', tipo: 'vini', piatti: [] })
    expect(menu[0].piatti.map((p) => p.numero)).toEqual([1, 2, 3, 4])
    expect(menu.reduce((n, c) => n + c.piatti.length, 0)).toBe(139)
  })
  it('mappa i campi in camelCase con i tipi giusti', async () => {
    const [tartare] = await leggiMenu(db)
    expect(tartare.piatti[0]).toMatchObject({
      categoriaId: 'tartare', numero: 1, nome: 'Salmone', prezzoCent: 600,
      allergeni: [], allergeniConfermati: false, disponibile: true,
    })
  })
  it('ogni categoria porta il suo reparto', async () => {
    const menu = await leggiMenu(db)
    expect(menu.find((c) => c.id === 'tartare')?.reparto).toBe('banco')
    expect(menu.find((c) => c.id === 'starter')?.reparto).toBe('cucina')
    expect(menu.find((c) => c.id === 'beverage')?.reparto).toBe('sala')
  })
})

describe('aggiornaRepartoCategoria', () => {
  it('cambia il reparto; categoria inesistente → false', async () => {
    expect(await aggiornaRepartoCategoria(db, 'dessert', 'sala')).toBe(true)
    expect((await leggiMenu(db)).find((c) => c.id === 'dessert')?.reparto).toBe('sala')
    expect(await aggiornaRepartoCategoria(db, 'nessuna', 'cucina')).toBe(false)
  })
  it('il database rifiuta un reparto fuori elenco', async () => {
    await expect(aggiornaRepartoCategoria(db, 'dessert', 'bar' as 'sala')).rejects.toThrow(/check/)
  })
})

describe('leggiPiatto', () => {
  it('trova per id', async () => {
    const p = await leggiPiatto(db, await idDi(20))
    expect(p?.nome).toBe('Salmone')
  })
  it('id inesistente o malformato → null, senza errori', async () => {
    expect(await leggiPiatto(db, '00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(await leggiPiatto(db, 'abc')).toBeNull()
    expect(await leggiPiatto(db, '')).toBeNull()
  })
})

describe('aggiornaPiatto', () => {
  it('salva tutti i campi e restituisce il piatto aggiornato', async () => {
    const id = await idDi(20)
    const p = await aggiornaPiatto(db, id, dati)
    expect(p).toMatchObject({ prezzoCent: 250, dellaCasa: true, allergeni: ['pesce', 'soia'], allergeniConfermati: true })
    expect((await leggiPiatto(db, id))?.descrizione).toBe('Riso e salmone')
  })
  it('id malformato → null', async () => {
    expect(await aggiornaPiatto(db, 'abc', dati)).toBeNull()
  })
})

describe('disponibilità e allergeni da confermare', () => {
  it('spegne e riaccende un piatto', async () => {
    const id = await idDi(21)
    expect(await impostaDisponibile(db, id, false)).toBe(true)
    expect((await leggiPiatto(db, id))?.disponibile).toBe(false)
    expect(await impostaDisponibile(db, 'abc', false)).toBe(false)
  })
  it('conta i piatti con allergeni non confermati', async () => {
    expect(await contaAllergeniDaConfermare(db)).toBe(139)
    await aggiornaPiatto(db, await idDi(20), dati)
    expect(await contaAllergeniDaConfermare(db)).toBe(138)
  })
})
