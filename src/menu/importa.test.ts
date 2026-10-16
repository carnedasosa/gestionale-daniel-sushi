import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { convertiMenu, type MenuJson } from './importa'

const json = JSON.parse(readFileSync('data/menu-sito.json', 'utf8')) as MenuJson
const menu = convertiMenu(json)

describe('convertiMenu', () => {
  it('porta tutte le categorie in ordine', () => {
    expect(menu.categorie).toHaveLength(14)
    expect(menu.categorie[0]).toEqual({ id: 'tartare', nome: 'Tartare', pezzi: null, posizione: 1, reparto: 'banco' })
    expect(menu.categorie.find((c) => c.id === 'uramaki')?.pezzi).toBe('8 pz.')
  })
  it('reparto di ogni categoria: cucina per starter, primi, dessert; sala per le bevande; il resto al banco', () => {
    const per = (r: string) => menu.categorie.filter((c) => c.reparto === r).map((c) => c.id).sort()
    expect(per('cucina')).toEqual(['dessert', 'primi', 'starter'])
    expect(per('sala')).toEqual(['beverage'])
    expect(per('banco')).toHaveLength(10)
  })
  it('porta tutti i 139 piatti, 27 dei quali senza numero', () => {
    expect(menu.piatti).toHaveLength(139)
    expect(menu.piatti.filter((p) => p.numero === null)).toHaveLength(27)
  })
  it('prezzi in centesimi e flag', () => {
    const poke = menu.piatti.find((p) => p.nome === "Philadelphia's poke")!
    expect(poke.prezzo_cent).toBe(1050)
    expect(poke.categoria_id).toBe('poke-bowl')
    const crispy = menu.piatti.find((p) => p.numero === 92)!
    expect(crispy.piccante).toBe(true)
    expect(menu.piatti.find((p) => p.nome === 'Edamame')!.vegetariano).toBe(true)
    expect(menu.piatti.find((p) => p.nome === "Daniel's poke")!.della_casa).toBe(true)
  })
  it('descrizione mancante diventa null; posizioni progressive per categoria', () => {
    const acqua = menu.piatti.find((p) => p.nome === 'Acqua naturale')!
    expect(acqua.descrizione).toBeNull()
    expect(acqua.posizione).toBe(1)
  })
  it('composer della poke con regole provvisorie e prezzo non impostato', () => {
    expect(menu.poke?.titolo).toBe('Componi la tua Poke')
    expect(menu.poke?.gruppi.map((g) => g.nome)).toEqual(['Base', 'Proteine', 'Condimenti', 'Salse', 'Topping'])
    expect(menu.poke?.gruppi[0]).toMatchObject({ min: 1, max: 1, inclusi: 1 })
    expect(menu.poke?.prezzoBaseCent).toBeNull()
  })
})
