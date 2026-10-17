import { expect, it, vi } from 'vitest'
import type pg from 'pg'
import { adattaPool, erroreDiAttesa, INIZIO_TRANSAZIONE, LIMITI_TEMPO, OPZIONI_POOL } from './db-adapter'

it('il pool passa a Postgres i limiti di tempo per istruzioni, lock e transazioni ferme', () => {
  expect(LIMITI_TEMPO).toEqual({ statement_timeout: 15000, lock_timeout: 5000, idle_in_transaction_session_timeout: 30000 })
  expect(OPZIONI_POOL).toMatchObject(LIMITI_TEMPO)
})

it('ogni transazione ripete i limiti con «set local» nella stessa query di begin', async () => {
  expect(INIZIO_TRANSAZIONE).toBe('begin; set local statement_timeout = 15000; set local lock_timeout = 5000; set local idle_in_transaction_session_timeout = 30000')
  const query = vi.fn(async (testo: string) => ({ rows: testo === 'select 1' ? [{ n: 1 }] : [] }))
  const client = { query, on: vi.fn(), off: vi.fn(), release: vi.fn() }
  const pool = { connect: async () => client } as unknown as pg.Pool
  expect(await adattaPool(() => pool).transazione(tx => tx.query('select 1'))).toEqual([{ n: 1 }])
  // Senza parametri pg usa il protocollo semplice: begin e set local partono in un solo viaggio.
  expect(query.mock.calls).toEqual([[INIZIO_TRANSAZIONE], ['select 1', []], ['commit']])
  expect(client.release).toHaveBeenCalledWith(undefined)
})

it('riconosce lock scaduto e istruzione annullata, non gli altri errori', () => {
  expect(erroreDiAttesa(Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' }))).toBe(true)
  expect(erroreDiAttesa(Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' }))).toBe(true)
  expect(erroreDiAttesa(Object.assign(new Error('duplicate key'), { code: '23505' }))).toBe(false)
  for (const altro of [new Error('connessione'), null, undefined, '55P03', { code: 55003 }]) expect(erroreDiAttesa(altro)).toBe(false)
})
