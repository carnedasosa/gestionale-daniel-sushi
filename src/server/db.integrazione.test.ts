import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import pg from 'pg'
import { avviaPostgresFinto, type PostgresFinto } from '../../tests/server/postgres-finto'
import { adattaPool, OPZIONI_POOL } from './db-adapter'

// Stesso pool della produzione (src/server/db.ts), puntato su un server Postgres finto.
let server: PostgresFinto, pool: pg.Pool
beforeEach(async () => {
  server = await avviaPostgresFinto()
  pool = new pg.Pool({ connectionString: server.url, ...OPZIONI_POOL, connectionTimeoutMillis: 2000 })
  pool.on('error', () => {})
})
afterEach(async () => { await pool.end(); await server.chiudi() })

it('una connessione persa durante una lettura non blocca il pool', async () => {
  const db = adattaPool(() => pool)
  await expect(db.query("select 'cade' as n")).rejects.toThrow()
  await expect(db.query('select 1 as n')).resolves.toEqual([{ n: '1' }])
  await expect(db.query('select $1::int as n', [1])).resolves.toEqual([{ n: '1' }])
  const tutte = await Promise.all(Array.from({ length: 12 }, () => db.query('select 1 as n')))
  expect(tutte).toEqual(Array.from({ length: 12 }, () => [{ n: '1' }]))
}, 5000)

it('una connessione persa dentro una transazione viene scartata e il pool continua', async () => {
  const db = adattaPool(() => pool)
  await expect(db.transazione(tx => tx.query("select 'cade' as n"))).rejects.toThrow()
  // Ogni connessione del pool deve funzionare: ne usiamo più del massimo, in sequenza e in parallelo.
  for (let i = 0; i < OPZIONI_POOL.max + 1; i++) await expect(db.transazione(tx => tx.query('select 1 as n'))).resolves.toEqual([{ n: '1' }])
  await expect(Promise.all(Array.from({ length: 12 }, () => db.transazione(tx => tx.query('select 1 as n'))))).resolves.toHaveLength(12)
  expect(pool.totalCount).toBeLessThanOrEqual(OPZIONI_POOL.max)
}, 5000)

it('un errore SQL nella transazione fa rollback e la connessione torna nel pool', async () => {
  const db = adattaPool(() => pool)
  const prima = server.connessioni()
  await expect(db.transazione(async tx => { await tx.query('select 1 as n'); throw new Error('regola violata') })).rejects.toThrow('regola violata')
  await expect(db.transazione(tx => tx.query('select 1 as n'))).resolves.toEqual([{ n: '1' }])
  expect(server.connessioni() - prima).toBe(1)
}, 5000)

it('non accoda mai due query sulla stessa connessione', async () => {
  const db = adattaPool(() => pool)
  await Promise.all([
    ...Array.from({ length: 10 }, () => db.query("select 'lenta' as n")),
    ...Array.from({ length: 3 }, () => db.transazione(tx => tx.query("select 'lenta' as n"))),
  ])
  expect(server.massimoPerConnessione()).toBe(1)
  expect(server.connessioni()).toBeLessThanOrEqual(OPZIONI_POOL.max)
}, 5000)

it('una connessione inattiva che cade non fa terminare il processo', async () => {
  const errori = vi.fn()
  pool.removeAllListeners('error'); pool.on('error', errori)
  await adattaPool(() => pool).query('select 1 as n')
  await server.chiudi()
  await vi.waitFor(() => expect(errori).toHaveBeenCalled())
}, 5000)
