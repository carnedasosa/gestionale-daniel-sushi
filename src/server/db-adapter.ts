import type pg from 'pg'
import type { Db } from './db-tipi'

// Limiti di tempo di Postgres, in millisecondi. Senza, una transazione bloccata (client sparito a metà,
// query lenta) terrebbe il lock su impostazioni_casa e metterebbe in coda tutti i checkout senza fine.
// - statement_timeout: una singola istruzione che dura oltre 15 s viene annullata (SQLSTATE 57014).
// - lock_timeout: chi aspetta un lock (es. «for update» sulle impostazioni, «for share» sui piatti)
//   rinuncia dopo 5 s (SQLSTATE 55P03) invece di restare in fila.
// - idle_in_transaction_session_timeout: una transazione aperta e ferma da 30 s viene chiusa da Postgres,
//   che termina la connessione e libera i lock.
export const LIMITI_TEMPO = { statement_timeout: 15_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 30_000 } as const

// Massimo 5 connessioni verso il transaction pooler di Supabase (porta 6543).
// Chi chiede una connessione oltre il limite aspetta al massimo 10 secondi, poi riceve un errore:
// connectionTimeoutMillis protegge solo l'attesa della connessione dal pool, non le query.
// I LIMITI_TEMPO qui sono parametri di avvio della connessione: pg 8.23 li mette nello startup message
// (Client.getStartupConf). Valgono in locale, sugli e2e e su una connessione diretta o in session mode.
// Il transaction pooler di Supabase (Supavisor) invece NON li inoltra a Postgres: legge dallo startup
// solo utente, database, application_name, search_path e options (lib/supavisor/client_handler/
// protocol_helpers.ex), e la documentazione Supabase dice che le impostazioni di sessione non
// funzionano sulla porta 6543. Per questo transazione() li ripete con «set local» (vedi sotto).
export const OPZIONI_POOL = { max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, ...LIMITI_TEMPO } satisfies pg.PoolConfig

// «set local» vale fino al commit o al rollback, quindi funziona anche dietro il transaction pooler,
// dove ogni transazione può finire su una connessione diversa verso Postgres. Va nella stessa query
// semplice di «begin» (senza parametri pg usa il protocollo semplice, che ammette più istruzioni):
// nessun viaggio in più verso il database.
export const INIZIO_TRANSAZIONE = ['begin', ...Object.entries(LIMITI_TEMPO).map(([nome, ms]) => `set local ${nome} = ${ms}`)].join('; ')

// Errori di Postgres che indicano attesa scaduta, non dati sbagliati: la transazione è stata annullata
// per intero (rollback), quindi riprovare dopo qualche secondo è sicuro.
// 55P03 lock_not_available (lock_timeout), 57014 query_canceled (statement_timeout o annullamento).
const CODICI_ATTESA = new Set(['55P03', '57014'])
export function erroreDiAttesa(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' && CODICI_ATTESA.has(err.code)
}

function suConnessione(c: pg.PoolClient): Db {
  return {
    async query<T>(testo: string, parametri: unknown[] = []) { return (await c.query(testo, parametri)).rows as T[] },
    async transazione() { throw new Error('Transazioni annidate non supportate') },
  }
}

// pg non accoda mai due query sulla stessa connessione e, dopo un errore di connessione,
// rifiuta subito le query successive su quella connessione invece di bloccarsi.
// Le query fuori da una transazione (pool.query) non hanno i limiti «set local»: dietro Supavisor
// valgono solo i limiti del ruolo Postgres (es. «alter role … set lock_timeout»).
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
        await c.query(INIZIO_TRANSAZIONE)
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
