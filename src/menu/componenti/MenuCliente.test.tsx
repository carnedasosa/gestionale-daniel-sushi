import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CategoriaConPiatti, Piatto } from '@/menu/repo'
import { MenuCliente } from './MenuCliente'

const base: Piatto = {
  id: 'p', categoriaId: 'uramaki', numero: null, nome: 'Piatto', descrizione: null, prezzoCent: 1050,
  piccante: false, vegetariano: false, dellaCasa: false, allergeni: [], allergeniConfermati: true,
  disponibile: true, posizione: 0,
}

const categorie: CategoriaConPiatti[] = [
  {
    id: 'uramaki', nome: 'Uramaki', pezzi: '8 pezzi', posizione: 0,
    piatti: [
      { ...base, id: 'a', nome: 'Esaurito con pesce', allergeni: ['pesce'], disponibile: false },
      { ...base, id: 'b', nome: 'Disponibile in verifica', allergeniConfermati: false },
      { ...base, id: 'c', nome: 'Disponibile senza allergeni' },
    ],
  },
]

function articolo(html: string, nome: string): string {
  const pezzo = html.split('<article').find((a) => a.includes(nome))
  if (!pezzo) throw new Error(`articolo non trovato: ${nome}`)
  return pezzo
}

describe('MenuCliente', () => {
  const html = renderToStaticMarkup(<MenuCliente categorie={categorie} />)

  it('piatto esaurito: classe, etichetta testuale e allergeni confermati', () => {
    const a = articolo(html, 'Esaurito con pesce')
    expect(a).toContain('b-piatto--esaurito')
    expect(a).toContain('>Esaurito stasera</span>')
    expect(a).not.toContain('<button')
    expect(a).toContain('Allergeni: Pesce')
  })

  it('piatto disponibile con allergeni non confermati: rimanda al personale, nessun Esaurito', () => {
    const a = articolo(html, 'Disponibile in verifica')
    expect(a).toContain('Allergeni in verifica: chiedi al personale prima di ordinare')
    expect(a).not.toContain('Esaurito')
    expect(a).not.toContain('b-piatto--esaurito')
  })

  it('piatto disponibile confermato senza allergeni: dichiara l’assenza', () => {
    const a = articolo(html, 'Disponibile senza allergeni')
    expect(a).toContain('Nessuno dei 14 allergeni')
    expect(a).not.toContain('Esaurito')
  })

  it('mostra il prezzo con spazio non separabile prima di €', () => {
    expect(html).toContain('<span class="b-num b-piatto__prezzo">10,50\u00a0€</span>')
  })

  it('in consultazione non ci sono bottoni per ordinare', () => {
    expect(html).not.toContain('<button')
  })

  it('fila delle categorie: una pillola per categoria che porta alla sua sezione, una sola evidenziata', () => {
    const due = renderToStaticMarkup(<MenuCliente categorie={[...categorie,{ id: 'nigiri',nome: 'Nigiri',pezzi: null,posizione: 1,piatti: [] }]} />)
    expect(due).toContain('aria-label="Vai alla categoria"')
    for (const id of ['uramaki','nigiri']) { expect(due).toContain(`href="#sez-${id}"`); expect(due).toContain(`id="sez-${id}"`) }
    expect(due.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toContain('8 pezzi')
  })
})
