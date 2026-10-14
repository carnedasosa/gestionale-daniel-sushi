import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { EtichettaStato } from './EtichettaStato'
import { DettaglioRighe } from './DettaglioRighe'
import { AltreAzioni } from './AltreAzioni'
import { ConfermaAzione } from './ConfermaAzione'
import { BarraBasso, seguiAltezza } from './BarraBasso'
import { readFileSync } from 'node:fs'
it('etichetta di stato: tono e testo', () => {
  const html = renderToStaticMarkup(<EtichettaStato stato="in_preparazione" testo="In preparazione" />)
  expect(html).toContain('b-stato--preparazione'); expect(html).toContain('In preparazione')
})
it('righe: quantità, nota, poke senza gruppi vuoti e riga annullata barrata', () => {
  const html = renderToStaticMarkup(<DettaglioRighe area="staff" righe={[
    { id: 'a',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 2,nota: 'senza sesamo',poke: null,annullata: false },
    { id: 'b',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: null,poke: { Base: ['Riso'],Topping: [] },annullata: false },
    { id: 'c',numero: 2,nome: 'Tonno',prezzoUnitCent: 700,quantita: 1,nota: null,poke: null,annullata: true }]} />)
  expect(html).toContain('b-nota'); expect(html).toContain('Nota: senza sesamo'); expect(html).toContain('Base:'); expect(html).not.toContain('Topping')
  expect(html).toContain('<s>'); expect(html).toContain('annullato'); expect(html).toMatch(/<strong class="b-num">2×<\/strong>/)
})
it('altre azioni: bottone discreto e azioni nel pannello titolato', () => {
  const html = renderToStaticMarkup(<AltreAzioni titolo="Altre azioni · Tavolo 1">{chiudi => <button type="button" onClick={chiudi}>Segna come letto</button>}</AltreAzioni>)
  expect(html).toMatch(/<button[^>]*b-btn--discreto[^>]*>Altre azioni<\/button>/); expect(html).toContain('Altre azioni · Tavolo 1'); expect(html).toContain('Segna come letto')
})
it('conferma: il bottone che apre ha lo stile scelto, la conferma è sempre piena e rossa', () => {
  const html = renderToStaticMarkup(<ConfermaAzione inCorso={false} domanda="Annullare?" conferma={() => {}} stile="discreto">Annulla</ConfermaAzione>)
  expect(html).toMatch(/<button[^>]*b-btn--discreto[^>]*>Annulla<\/button>/); expect(html).toMatch(/<button[^>]*b-btn--pieno-pericolo[^>]*>Annulla<\/button>/); expect(html).toContain('Conferma')
})
it('righe: il numero del piatto si vede in cucina, non al cliente', () => {
  const righe = [{ id: 'a',numero: 26,nome: 'Salmone roll',prezzoUnitCent: 600,quantita: 1,nota: null,poke: null,annullata: false }]
  expect(renderToStaticMarkup(<DettaglioRighe area="staff" righe={righe} />)).toContain('26 ')
  expect(renderToStaticMarkup(<DettaglioRighe area="tavolo" righe={righe} />)).not.toContain('26 ')
})
it('barra in basso: l’altezza misurata passa alla radice e segue i cambi; via la barra, via la variabile', () => {
  let altezza = 200.4, richiamo = () => {}, staccato = false
  class Osservatore { constructor(cb: () => void) { richiamo = cb } observe() {} disconnect() { staccato = true } }
  const stile = new Map<string,string>()
  const radice = { style: { setProperty: (k: string,v: string) => stile.set(k,v),removeProperty: (k: string) => stile.delete(k) } }
  const barra = { getBoundingClientRect: () => ({ height: altezza }) }
  const stacca = seguiAltezza(barra as unknown as HTMLElement,radice as unknown as HTMLElement,Osservatore as unknown as typeof ResizeObserver)
  expect(stile.get('--b-barra-altezza')).toBe('201px')
  altezza = 150; richiamo()
  expect(stile.get('--b-barra-altezza')).toBe('150px')
  stacca()
  expect(staccato).toBe(true); expect(stile.has('--b-barra-altezza')).toBe(false)
})
it('barra in basso: markup e spazio sotto la pagina pari alla barra misurata', () => {
  expect(renderToStaticMarkup(<BarraBasso><button>Carrello</button></BarraBasso>)).toBe('<div class="b-barra-basso"><div class="b-barra-basso__dentro"><button>Carrello</button></div></div>')
  const css = readFileSync(new URL('../styles/banco/componenti.css',import.meta.url),'utf8')
  expect(css).toMatch(/main\.b-con-barra \{ padding-bottom: calc\(var\(--b-barra-altezza,/)
})
