import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { convertiMenu, type MenuJson } from './importa'
import { generaSeedSql } from './seed-sql'
import { creaDbDiTest } from '../../tests/db/pglite'

const menu = convertiMenu(JSON.parse(readFileSync('data/menu-sito.json', 'utf8')) as MenuJson)

describe('generaSeedSql', () => {
  it('si applica a un database vuoto e porta tutto il menù', async () => {
    const { pg, db } = await creaDbDiTest()
    await pg.exec(generaSeedSql(menu))
    const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from piatti')
    expect(n).toBe(139)
    const [{ c }] = await db.query<{ c: number }>('select count(*)::int as c from categorie')
    expect(c).toBe(14)
  })
  it('gestisce gli apostrofi (Daniel\'s poke)', async () => {
    const { pg, db } = await creaDbDiTest()
    await pg.exec(generaSeedSql(menu))
    const righe = await db.query<{ prezzo_cent: number }>(`select prezzo_cent from piatti where nome = $1`, ["Daniel's poke"])
    expect(righe).toEqual([{ prezzo_cent: 1050 }])
  })
  it('salva il composer della poke', async () => {
    const { pg, db } = await creaDbDiTest()
    await pg.exec(generaSeedSql(menu))
    const [p] = await db.query<{ gruppi: Array<{ nome: string }>; prezzo_base_cent: number | null }>('select gruppi, prezzo_base_cent from poke_config')
    expect(p.gruppi).toHaveLength(5)
    expect(p.prezzo_base_cent).toBeNull()
  })
})
