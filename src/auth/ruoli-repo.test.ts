import { beforeEach, describe, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import type { Db } from '@/server/db-tipi'
import { assegnaRuoloPerEmail, leggiRuolo } from './ruoli-repo'

let db: Db
const ID = '11111111-1111-1111-1111-111111111111'

beforeEach(async () => {
  ;({ db } = await creaDbDiTest())
  await db.query('insert into auth.users (id, email) values ($1, $2)', [ID, 'daniel@example.com'])
})

describe('ruoli', () => {
  it('utente senza profilo → null', async () => {
    expect(await leggiRuolo(db, ID)).toBeNull()
  })
  it('id malformato → null senza errori', async () => {
    expect(await leggiRuolo(db, 'abc')).toBeNull()
  })
  it('assegna e cambia il ruolo per email', async () => {
    expect(await assegnaRuoloPerEmail(db, 'daniel@example.com', 'staff')).toBe(true)
    expect(await leggiRuolo(db, ID)).toBe('staff')
    expect(await assegnaRuoloPerEmail(db, 'DANIEL@example.com', 'admin')).toBe(true)
    expect(await leggiRuolo(db, ID)).toBe('admin')
  })
  it('email sconosciuta → false', async () => {
    expect(await assegnaRuoloPerEmail(db, 'nessuno@example.com', 'admin')).toBe(false)
  })
})
