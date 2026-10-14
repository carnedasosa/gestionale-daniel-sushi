import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ElencoPiatti, filtraCategorie } from './ElencoPiatti'
const categorie = [{ id: 'tartare',nome: 'Tartare',pezzi: null,piatti: [{ id: 'a',numero: 1,nome: 'Salmone',prezzoCent: 600,allergeniConfermati: true,disponibile: true },{ id: 'b',numero: 4,nome: 'Mini Tonno',prezzoCent: 600,allergeniConfermati: false,disponibile: false }] },
  { id: 'sashimi',nome: 'Sashimi',pezzi: '5 pz.',piatti: [{ id: 'c',numero: 5,nome: 'Salmone',prezzoCent: 500,allergeniConfermati: true,disponibile: true }] },
  { id: 'dessert',nome: 'Dessert',pezzi: null,piatti: [{ id: 'd',numero: null,nome: 'Soufflé al cioccolato',prezzoCent: 500,allergeniConfermati: true,disponibile: true }] }]
it('ricerca per nome (senza accenti e maiuscole) o per numero esatto, categorie vuote nascoste', () => {
  expect(filtraCategorie(categorie,'TONNO').map(c => c.piatti.map(p => p.id))).toEqual([['b']])
  expect(filtraCategorie(categorie,'souffle').map(c => c.id)).toEqual(['dessert'])
  expect(filtraCategorie(categorie,'5').map(c => c.id)).toEqual(['sashimi'])
  expect(filtraCategorie(categorie,'  ')).toEqual(categorie)
  expect(filtraCategorie(categorie,'zzz')).toEqual([])
})
it('interruttore e stato degli allergeni per ogni piatto', () => {
  const html = renderToStaticMarkup(<ElencoPiatti categorie={categorie} cambia={async () => {}} />)
  expect(html).toContain('aria-checked="false"'); expect(html).toContain('Esaurito'); expect(html).toContain('Da confermare'); expect(html).toContain('href="/admin/menu/a"'); expect(html).toContain('Cerca un piatto')
})
