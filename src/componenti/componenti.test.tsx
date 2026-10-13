import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { EtichettaStato } from './EtichettaStato'
import { DettaglioRighe } from './DettaglioRighe'
import { AltreAzioni } from './AltreAzioni'
import { ConfermaAzione } from './ConfermaAzione'
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
