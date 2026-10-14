import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { convertiMenu, type MenuJson } from '@/menu/importa'
import { sqlProposta } from '@/menu/allergeni-proposta'
import { creaDbDiTest } from './pglite'

const menu = convertiMenu(JSON.parse(readFileSync('data/menu-sito.json','utf8')) as MenuJson)
const sql = sqlProposta(menu.poke!.gruppi)
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest({ seed: true }) })
afterEach(async () => { await ambiente.pg.close() })
const conta = async (dove: string) => (await ambiente.db.query<{ n: number }>(`select count(*)::int as n from piatti where ${dove}`))[0].n

describe('SQL della proposta degli allergeni', () => {
  it('compila tutti i piatti e la poke senza confermare niente', async () => {
    await ambiente.pg.exec(sql)
    expect(await conta('true')).toBe(139)
    expect(await conta('allergeni_confermati')).toBe(0)
    expect(await conta(`allergeni <> '{}'`)).toBe(139 - 12) // patatine, 2 sorbetti, acque, bibite, tè e la birra senza glutine
    const [poke] = await ambiente.db.query<{ voci: Record<string,Record<string,string[]>>; confermati: boolean }>('select allergeni_voci as voci,allergeni_confermati as confermati from poke_config where id=1')
    expect(poke.confermati).toBe(false)
    expect(poke.voci.Proteine['Tofu']).toEqual(['soia'])
  })
  it('non tocca i piatti già compilati o confermati da Daniel', async () => {
    await ambiente.pg.exec(`update piatti set allergeni = '{latte}' where categoria_id = 'tartare' and numero = 1;
      update piatti set allergeni_confermati = true where categoria_id = 'sashimi' and numero = 5;
      update poke_config set allergeni_voci = '{"Base":{}}'::jsonb`)
    await ambiente.pg.exec(sql)
    const leggi = async (cat: string, n: number) => (await ambiente.db.query<{ allergeni: string[] }>('select allergeni from piatti where categoria_id=$1 and numero=$2',[cat,n]))[0].allergeni
    expect(await leggi('tartare',1)).toEqual(['latte'])
    expect(await leggi('sashimi',5)).toEqual([])
    expect(await leggi('sashimi',6)).toEqual(['pesce'])
    expect((await ambiente.db.query<{ voci: unknown }>('select allergeni_voci as voci from poke_config')).at(0)!.voci).toEqual({ Base: {} })
  })
})
