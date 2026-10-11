import 'server-only'
import postgres from 'postgres'
import type { Db } from './db-tipi'
import { adattaSql } from './db-adapter'

let sql: postgres.Sql | undefined

function client(): postgres.Sql {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL mancante: vedi .env.example')
  // prepare: false è necessario con il transaction pooler di Supabase (porta 6543)
  sql ??= postgres(url, { prepare: false, max: 5 })
  return sql
}

export const db: Db = {
  async query<T>(text: string, params: unknown[] = []) {
    return (await client().unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[]
  },
  transazione: (fn) => adattaSql(client()).transazione(fn),
}
