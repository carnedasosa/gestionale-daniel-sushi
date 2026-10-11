import { beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'
import type { Db } from '@/server/db-tipi'

let db: Db

beforeEach(async () => {
  ;({ db } = await creaDbDiTest())
  await db.query(`insert into categorie (id, nome, posizione) values ('nigiri', 'Nigiri', 1)`)
})

const inserisci = (campi: string, valori: string) =>
  db.query(`insert into piatti (categoria_id, nome, prezzo_cent, posizione${campi}) values ('nigiri', 'Salmone', 200, 1${valori})`)

describe('schema piatti', () => {
  it('valori di default sensati', async () => {
    await inserisci('', '')
    const [p] = await db.query<{ disponibile: boolean; allergeni: string[]; allergeni_confermati: boolean }>(
      'select disponibile, allergeni, allergeni_confermati from piatti',
    )
    expect(p).toEqual({ disponibile: true, allergeni: [], allergeni_confermati: false })
  })
  it('rifiuta prezzi negativi', async () => {
    await expect(db.query(`insert into piatti (categoria_id, nome, prezzo_cent, posizione) values ('nigiri', 'X', -1, 1)`)).rejects.toThrow()
  })
  it('rifiuta allergeni sconosciuti', async () => {
    await expect(inserisci(', allergeni', `, array['pesce','avocado']`)).rejects.toThrow()
  })
  it('accetta allergeni validi', async () => {
    await inserisci(', allergeni', `, array['pesce','sesamo']`)
  })
  it('numero unico, ma più piatti senza numero', async () => {
    await inserisci(', numero', ', 20')
    await expect(inserisci(', numero', ', 20')).rejects.toThrow()
    await inserisci('', '')
    await inserisci('', '')
  })
  it('una sola riga di poke_config', async () => {
    await db.query(`insert into poke_config (titolo, gruppi) values ('Poke', '[]')`)
    await expect(db.query(`insert into poke_config (id, titolo, gruppi) values (2, 'Poke', '[]')`)).rejects.toThrow()
  })
  it('ruoli solo staff o admin', async () => {
    await db.query(`insert into profili (user_id, ruolo) values (gen_random_uuid(), 'admin')`)
    await expect(db.query(`insert into profili (user_id, ruolo) values (gen_random_uuid(), 'cuoco')`)).rejects.toThrow()
  })
  it('RLS attiva: un utente autenticato non legge nulla via API', async () => {
    await inserisci('', '')
    await db.query(`grant select on piatti to authenticated`)
    await db.query(`set role authenticated`)
    expect(await db.query('select * from piatti')).toEqual([])
    await db.query(`reset role`)
  })
})
