import { expect, it, vi } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { leggiAllergeniPoke, leggiPokeConfig, salvaAllergeniPoke, salvaPokeConfig } from './poke-repo'
it('allergeni degli ingredienti: vuoti di default, salvati e ripuliti dalle voci che non esistono più', async () => {
  const { db, pg } = await creaDbDiTest({ seed: true })
  try {
    const c = (await leggiPokeConfig(db))!
    const base = c.gruppi[0]
    const vuoti = await leggiAllergeniPoke(db,c)
    expect(vuoti.confermati).toBe(false)
    expect(vuoti.voci[base.nome][base.voci[0]]).toEqual([])
    await salvaAllergeniPoke(db,{ voci: { ...vuoti.voci,[base.nome]: { ...vuoti.voci[base.nome],[base.voci[0]]: ['sesamo','glutine'],Sparito: ['latte'] } },confermati: true })
    const letti = await leggiAllergeniPoke(db,c)
    expect(letti.confermati).toBe(true)
    expect(letti.voci[base.nome][base.voci[0]]).toEqual(['glutine','sesamo'])
    expect(Object.hasOwn(letti.voci[base.nome],'Sparito')).toBe(false)
  } finally { await pg.close() }
})
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
