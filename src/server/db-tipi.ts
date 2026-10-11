// Interfaccia minima verso Postgres: in produzione è il driver `postgres`, nei test è PGlite.
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
}
