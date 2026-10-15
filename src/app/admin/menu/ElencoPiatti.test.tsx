import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ElencoPiatti, codaPillole, filtraCategorie, sezioneAttiva } from './ElencoPiatti'
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
it('fila delle categorie: una pillola per categoria che porta alla sua sezione', () => {
  const html = renderToStaticMarkup(<ElencoPiatti categorie={categorie} cambia={async () => {}} />)
  expect(html).toContain('aria-label="Vai alla categoria"')
  for (const id of ['tartare','sashimi','dessert']) { expect(html).toContain(`href="#sez-${id}"`); expect(html).toContain(`id="sez-${id}"`) }
  expect(html.match(/aria-current="true"/g)).toHaveLength(1)
})
it("categoria evidenziata: l'ultima il cui titolo è salito sotto la barra", () => {
  const sezioni = [{ id: 'a',top: -400 },{ id: 'b',top: 60 },{ id: 'c',top: 900 }]
  expect(sezioneAttiva(sezioni,80)).toBe('b')
  expect(sezioneAttiva(sezioni,40)).toBe('a')
  expect(sezioneAttiva([{ id: 'a',top: 300 }],80)).toBe('a')
  expect(sezioneAttiva([],80)).toBeNull()
})
it('sfumatura dal lato in cui la fila continua', () => {
  expect(codaPillole(0,300,300)).toBeUndefined()
  expect(codaPillole(0,300,900)).toBe('destra')
  expect(codaPillole(200,300,900)).toBe('entrambe')
  expect(codaPillole(600,300,900)).toBe('sinistra')
})
