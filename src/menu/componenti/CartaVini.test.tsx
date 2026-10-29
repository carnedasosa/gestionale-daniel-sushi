import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CategoriaConPiatti, Piatto } from '@/menu/repo'
import { MenuCliente } from './MenuCliente'

const base: Piatto = {
  id: 'p', categoriaId: 'vini', numero: null, nome: 'Vino', descrizione: null, prezzoCent: 2200,
  piccante: false, vegetariano: false, dellaCasa: false, allergeni: ['solfiti'], allergeniConfermati: true,
  disponibile: true, posizione: 0, foto: null, vino: null,
}
const vino = (tipologia: 'bianco' | 'rosso', formato: 'bottiglia' | 'calice') => ({ tipologia, formato, cantina: 'Tormaresca', denominazione: 'Castel del Monte DOC', annata: 2022 })
const sushi: CategoriaConPiatti = { id: 'nigiri', nome: 'Nigiri', pezzi: null, posizione: 1, reparto: 'banco', tipo: 'piatti', piatti: [{ ...base, id: 'n', categoriaId: 'nigiri', nome: 'Salmone', allergeni: ['pesce'] }] }
const carta = (piatti: Piatto[]): CategoriaConPiatti => ({ id: 'vini', nome: 'Carta dei vini', pezzi: null, posizione: 1000, reparto: 'sala', tipo: 'vini', piatti })

it('la carta dei vini raggruppa per tipologia con cantina, denominazione, annata e formato', () => {
  const html = renderToStaticMarkup(<MenuCliente categorie={[sushi, carta([
    { ...base, id: 'r', nome: 'Bocca di Lupo', vino: vino('rosso', 'bottiglia') },
    { ...base, id: 'b', nome: 'Falanghina', prezzoCent: 500, vino: vino('bianco', 'calice') },
  ])]} />)
  expect(html.indexOf('Bianchi')).toBeGreaterThan(-1)
  expect(html.indexOf('Bianchi')).toBeLessThan(html.indexOf('Rossi'))
  expect(html.indexOf('Falanghina')).toBeLessThan(html.indexOf('Bocca di Lupo'))
  expect(html).toContain('Tormaresca · Castel del Monte DOC · 2022')
  expect(html).toContain('Calice')
  expect(html).toContain('Bottiglia 0,75 l')
  expect(html).toContain('href="#sez-vini"')
})
it('la carta dei vini vuota non compare né nel menù né nella fila delle categorie', () => {
  const html = renderToStaticMarkup(<MenuCliente categorie={[sushi, carta([])]} />)
  expect(html).not.toContain('Carta dei vini')
  expect(html).not.toContain('sez-vini')
  expect(html).toContain('sez-nigiri')
})
