import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { convertiMenu, type MenuJson } from './importa'
import { allergeniPokeProposti, PROPOSTA, risolviProposta } from './allergeni-proposta'

const menu = convertiMenu(JSON.parse(readFileSync('data/menu-sito.json', 'utf8')) as MenuJson)
const chiave = (p: { categoria: string; numero: number | null; nome: string }) => `${p.categoria}|${p.numero ?? p.nome}`
const risolta = risolviProposta()
const di = (numero: number) => risolta.find((p) => p.numero === numero)!

describe('proposta degli allergeni', () => {
  it('copre ogni piatto del menù una sola volta, con lo stesso nome', () => {
    const attesi = menu.piatti.map((p) => chiave({ categoria: p.categoria_id, numero: p.numero, nome: p.nome })).sort()
    expect(PROPOSTA.map(chiave).sort()).toEqual(attesi)
    for (const p of PROPOSTA) expect(menu.piatti.find((m) => chiave({ categoria: m.categoria_id, numero: m.numero, nome: m.nome }) === chiave(p))!.nome).toBe(p.nome)
  })
  it('ricava gli allergeni dagli ingredienti, nell’ordine ufficiale', () => {
    expect(di(1).allergeni).toEqual(['pesce'])
    expect(di(81).allergeni).toEqual(['glutine', 'crostacei', 'pesce', 'soia', 'latte', 'sesamo'])
    expect(di(114).allergeni).toEqual(['glutine', 'uova', 'pesce', 'soia', 'molluschi'])
    expect(risolta.find((p) => p.nome === 'Coca Cola')!.allergeni).toEqual([])
    expect(risolta.find((p) => p.nome === 'Birra Corona')!.allergeni).toEqual(['glutine'])
  })
  it('i box sommano i piatti che contengono', () => {
    // 9 Philadelphia Gio, 20 nigiri salmone, 26 e 28 uramaki, 46 gamberi in tempura.
    expect(di(49).allergeni).toEqual(['glutine', 'crostacei', 'pesce', 'latte'])
    const specialRoll = new Set(risolta.filter((p) => p.categoria === 'special-roll').flatMap((p) => p.allergeni))
    for (const c of specialRoll) expect(di(50).allergeni).toContain(c)
  })
  it('ogni piatto con dubbi ha le sue domande per Daniel', () => {
    expect(di(1).domande.some((d) => d.includes('condita la tartare'))).toBe(true)
    expect(di(26).domande.some((d) => d.includes('sesamo'))).toBe(true)
  })
  it('copre ogni ingrediente della poke composta', () => {
    const voci = allergeniPokeProposti(menu.poke!.gruppi)
    expect(Object.keys(voci)).toEqual(menu.poke!.gruppi.map((g) => g.nome))
    expect(voci.Proteine['Gamberi in tempura']).toEqual(['glutine', 'crostacei'])
    expect(voci.Topping['Philadelphia senza lattosio']).toEqual(['latte'])
    expect(voci.Base['Riso bianco']).toEqual([])
  })
})
