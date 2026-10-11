import { expect, it, vi } from 'vitest'
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
it('rifiuta gruppi serializzati come stringa e forme corrotte senza rompere la lettura', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  const log = vi.spyOn(console,'error').mockImplementation(() => {})
  try {
    const config = (await leggiPokeConfig(db))!
    const gruppo = config.gruppi[0]
    const errati = ['[]',null,{},[{ ...gruppo,voci: [1] }],[{ ...gruppo,min: 0.5 }],[{ ...gruppo,max: -1 }],[{ ...gruppo,inclusi: gruppo.max+1 }]]
    for (const gruppi of errati) {
      await db.query('update poke_config set gruppi=$1::text::jsonb where id=1',[JSON.stringify(gruppi)])
      expect(await leggiPokeConfig(db)).toBeNull()
    }
    expect(log).toHaveBeenCalledTimes(errati.length)
    expect(log).toHaveBeenCalledWith('poke_config non valida')
  } finally { log.mockRestore(); await pg.close() }
})
