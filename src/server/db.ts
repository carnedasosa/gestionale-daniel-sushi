import 'server-only'
import pg from 'pg'
import type { Db } from './db-tipi'
import { adattaPool, OPZIONI_POOL } from './db-adapter'

let pool: pg.Pool | undefined
function client(): pg.Pool {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante: vedi .env.example')
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, ...OPZIONI_POOL })
    // Senza questo ascoltatore, una connessione inattiva che cade farebbe terminare il processo.
    pool.on('error', err => console.error('Connessione al database persa:', err.message))
  }
  return pool
}

export const db: Db = adattaPool(client)
