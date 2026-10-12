import type { ConnectionOptions } from 'node:tls'
import { CA_SUPABASE_2021 } from './ca-supabase'

const LOCALI = new Set(['localhost','127.0.0.1','[::1]'])
// In pg i parametri TLS dell'URL sostituiscono l'opzione ssl: la verifica del certificato sparirebbe.
const PARAMETRI_TLS = /^(ssl.*|uselibpqcompat)$/i

/** TLS verso il database: spento solo in locale, altrimenti con la CA di Supabase e il certificato verificato. */
export function opzioniTls(url: string): false | ConnectionOptions {
  let indirizzo: URL
  try { indirizzo = new URL(url) } catch { throw new Error('DATABASE_URL non è un indirizzo valido') }
  if ([...indirizzo.searchParams.keys()].some(k => PARAMETRI_TLS.test(k)))
    throw new Error('DATABASE_URL non deve contenere parametri ssl/sslmode: la cifratura la imposta il gestionale')
  if (LOCALI.has(indirizzo.hostname.toLowerCase())) return false
  return { ca: CA_SUPABASE_2021,rejectUnauthorized: true }
}
