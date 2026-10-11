import { expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { leggiPokeConfig, salvaPokeConfig } from './poke-repo'
it('legge seed e salva prezzi e regole della poke', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  try {
    const c = (await leggiPokeConfig(db))!
    expect(c.gruppi).toHaveLength(5)
    expect(c.prezzoBaseCent).toBeNull()
    c.prezzoBaseCent = 900; c.prezzoExtraCent = 100; c.gruppi[0].min = 0
    await salvaPokeConfig(db, c)
    expect(await leggiPokeConfig(db)).toEqual(c)
  } finally { await pg.close() }
})
