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
    const [u1, u2] = await db.query<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'a@x.it'), (gen_random_uuid(), 'b@x.it') returning id`,
    )
    await db.query(`insert into profili (user_id, ruolo) values ($1, 'admin')`, [u1.id])
    await expect(db.query(`insert into profili (user_id, ruolo) values ($1, 'cuoco')`, [u2.id])).rejects.toThrow(/check/i)
  })
  it('un profilo richiede un utente esistente', async () => {
    await expect(db.query(`insert into profili (user_id, ruolo) values (gen_random_uuid(), 'staff')`)).rejects.toThrow(/foreign key|violates/i)
  })
  it('eliminando l’utente si elimina anche il suo profilo', async () => {
    const [u] = await db.query<{ id: string }>(`insert into auth.users (id, email) values (gen_random_uuid(), 'c@x.it') returning id`)
    await db.query(`insert into profili (user_id, ruolo) values ($1, 'staff')`, [u.id])
    await db.query(`delete from auth.users where id = $1`, [u.id])
    expect(await db.query('select * from profili')).toEqual([])
  })
  it('RLS attiva: un utente autenticato non legge nulla via API', async () => {
    await inserisci('', '')
    await db.query(`grant select on piatti to authenticated`)
    await db.query(`set role authenticated`)
    expect(await db.query('select * from piatti')).toEqual([])
    await db.query(`reset role`)
  })
})
