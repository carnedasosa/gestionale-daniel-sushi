// Verifica il driver reale senza modificare dati persistenti: la tabella è temporanea.
import assert from 'node:assert/strict'
import pg from 'pg'
import { adattaPool, OPZIONI_POOL } from '../src/server/db-adapter'
import { opzioniTls } from '../src/server/tls-db'
import { leggiPokeConfig, salvaPokeConfig } from '../src/tavoli/poke-repo'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL!, ...OPZIONI_POOL, max: 1, ssl: opzioniTls(process.env.DATABASE_URL!) })
pool.on('error', err => console.error('Connessione al database persa:', err.message))
async function verifica() {
try {
  await adattaPool(() => pool).transazione(async db => {
    await db.query('create temporary table poke_config (like public.poke_config including all) on commit drop')
    await db.query('insert into pg_temp.poke_config select * from public.poke_config')
    // Recupera anche una configurazione di prova salvata dal vecchio driver.
    await db.query("update pg_temp.poke_config set gruppi=(gruppi #>> '{}')::jsonb where jsonb_typeof(gruppi)='string'")
    const config = (await leggiPokeConfig(db))!
    assert.ok(Array.isArray(config.gruppi))
    await salvaPokeConfig(db, { ...config, prezzoBaseCent: 900, prezzoExtraCent: 100 })
    const riletta = (await leggiPokeConfig(db))!
    assert.deepEqual(riletta.gruppi, config.gruppi)
    assert.equal(riletta.prezzoBaseCent, 900)
    assert.equal(riletta.prezzoExtraCent, 100)
  })
  console.log('Poke: round-trip JSON e prezzi verificati con PostgreSQL; nessun dato persistente modificato.')
} finally {
  await pool.end()
}
}
verifica().catch(err => { console.error(err instanceof Error ? err.message : 'Verifica non riuscita'); process.exitCode = 1 })
