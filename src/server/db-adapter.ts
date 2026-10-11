import type postgres from 'postgres'
import type { Db } from './db-tipi'
// Condivide il contratto transazionale con gli script server, senza caricare credenziali.
export function adattaSql(sql: postgres.Sql | postgres.TransactionSql): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) {
      return await sql.unsafe(testo,parametri as postgres.ParameterOrJSON<never>[]) as unknown as T[]
    },
    async transazione<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const risultato = 'savepoint' in sql
        ? await sql.savepoint(tx => fn(adattaSql(tx)))
        : await sql.begin(tx => fn(adattaSql(tx)))
      // postgres usa UnwrapPromiseArray anche per callback generiche.
      return risultato as T
    },
  }
}
