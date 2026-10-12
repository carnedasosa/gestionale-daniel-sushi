import type pg from 'pg'
import type { Db } from './db-tipi'

// Massimo 5 connessioni verso il transaction pooler di Supabase (porta 6543).
// Chi chiede una connessione oltre il limite aspetta al massimo 10 secondi, poi riceve un errore.
export const OPZIONI_POOL = { max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 } satisfies pg.PoolConfig

function suConnessione(c: pg.PoolClient): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) { return (await c.query(testo, parametri)).rows as T[] },
    async transazione() { throw new Error('Transazioni annidate non supportate') },
  }
}

// pg non accoda mai due query sulla stessa connessione e, dopo un errore di connessione,
// rifiuta subito le query successive su quella connessione invece di bloccarsi.
export function adattaPool(pool: () => pg.Pool): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) {
      // pool.query restituisce la connessione al pool, o la scarta se è caduta.
      return (await pool().query(testo, parametri)).rows as T[]
    },
    async transazione<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const c = await pool().connect()
      let scarta: Error | undefined
      // Mentre la connessione è in uso il pool non ne ascolta gli errori: senza questo ascoltatore
      // una caduta durante la transazione diventerebbe un'eccezione non gestita.
      const caduta = (err: Error) => { scarta = err }
      c.on('error', caduta)
      try {
        await c.query('begin')
        const risultato = await fn(suConnessione(c))
        await c.query('commit')
        return risultato
      } catch (err) {
        // Se il rollback fallisce la connessione non è affidabile: release(errore) la chiude
        // invece di rimetterla nel pool. L'errore da riportare resta quello originale.
        await c.query('rollback').catch((e: unknown) => { scarta = e instanceof Error ? e : new Error('Rollback non riuscito') })
        throw err
      } finally {
        c.off('error', caduta)
        c.release(scarta)
      }
    },
  }
}
