// Verifica il driver reale senza modificare dati persistenti: la tabella è temporanea.
import assert from 'node:assert/strict'
import postgres from 'postgres'
import { adattaSql } from '../src/server/db-adapter'
import { leggiPokeConfig, salvaPokeConfig } from '../src/tavoli/poke-repo'

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false })
async function verifica() {
try {
  await sql.begin(async tx => {
    await tx.unsafe('create temporary table poke_config (like public.poke_config including all) on commit drop')
    await tx.unsafe('insert into pg_temp.poke_config select * from public.poke_config')
    // Recupera anche una configurazione di prova salvata dal vecchio driver.
    await tx.unsafe("update pg_temp.poke_config set gruppi=(gruppi #>> '{}')::jsonb where jsonb_typeof(gruppi)='string'")
    const db = adattaSql(tx)
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
  await sql.end()
}
}
verifica().catch(err => { console.error(err instanceof Error ? err.message : 'Verifica non riuscita'); process.exitCode = 1 })
