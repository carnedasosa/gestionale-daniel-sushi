import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ apriTavolo: vi.fn(), chiudiTavolo: vi.fn(), avanzaOrdine: vi.fn(), annullaOrdineStaff: vi.fn(), annullaRigaStaff: vi.fn() }))
vi.mock('./azioni-menu', () => ({ cambiaDisponibilitaStaff: vi.fn() }))
vi.mock('./azioni-casa', () => ({ apriOrdiniOnline: vi.fn(), chiudiOrdiniOnline: vi.fn(), accettaOrdineStaff: vi.fn(), rifiutaOrdineStaff: vi.fn(), avanzaOrdineCasaStaff: vi.fn(), annullaOrdineCasaStaff: vi.fn() }))
import { CardOrdine } from './SchermoStaff'
import { CardOrdineCasa } from './OrdiniCasa'
import type { OrdineCasaClient } from '@/casa/ordini-casa-repo'
import type { OrdineClient } from '@/tavoli/ordini-repo'
const online = { accesi: true,asporto: null,domicilio: 'Consegne a domicilio non disponibili.' }
const tavolo: OrdineClient = { id: 'o',numero: 8,stato: 'inviato',totaleCent: 900,creatoIl: '2026-10-11T18:00:00Z',sessioneId: 's',tavoloNome: 'Tavolo 1',tavoloChiuso: false,righe: [{ id: 'r',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: 'senza sesamo',poke: { Base: ['Riso'],Proteine: ['Tonno'] },annullata: false },{ id: 'r2',numero: 2,nome: 'Salmone',prezzoUnitCent: 600,quantita: 1,nota: null,poke: null,annullata: true }] }
const casa: OrdineCasaClient = { id: 'c',numero: 9,tipo: 'domicilio',stato: 'in_attesa',token: 't'.repeat(32),totaleCent: 2000,consegnaCent: 200,fascia: '2026-10-11T17:30:00.000Z',creatoIl: '2026-10-11T17:00:00.000Z',aggiornatoIl: '2026-10-11T17:00:00.000Z',
  clienteNome: 'Anna',clienteTelefono: '3331234567',clienteEmail: 'anna@esempio.it',zonaNome: 'Bitetto',indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi',pagamento: 'contanti',contantiDaCent: 5000,motivoRifiuto: null,anonimizzato: false,
  righe: [{ id: 'rc',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 3,nota: null,poke: null,annullata: false }] }
it('evidenzia note e poke, barra annullati e mostra tempo e stato', () => {
  const html = renderToStaticMarkup(<CardOrdine ordine={tavolo} ora="2026-10-11T18:05:00Z" nuovo={true} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).toContain('b-comanda--nuovo'); expect(html).toContain('senza sesamo'); expect(html).toContain('b-nota'); expect(html).toContain('Tonno'); expect(html).toContain('<s>'); expect(html).toContain('aria-label="5 min"'); expect(html).toContain('Inizia a preparare')
  expect(html.match(/<h3[^>]*>(.*?)<\/h3>/)![1].replace(/<[^>]+>/g,'')).toBe('Tavolo 1 · n. 8')
})
it('senza dati e senza dati precedenti mostra il caricamento invece di smontarsi', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  expect(renderToStaticMarkup(<SchermoStaff dati={null} ora="2026-10-11T18:05:00Z" />)).toContain('Caricamento dello schermo')
  const html = renderToStaticMarkup(<SchermoStaff dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [],casa: [],ordiniOnline: { ...online,accesi: false } }} ora="2026-10-11T18:05:00Z" />)
  expect(html).toContain('Da preparare'); expect(html).toContain('Nessun tavolo configurato'); expect(html).toContain('Ordini online: chiusi'); expect(html).toContain('Apri ordini di oggi'); expect(html).toContain('Nessun ordine da accettare')
})
it('ordine da accettare: orario di Roma, cliente, indirizzo, pagamento e i quattro bottoni; evidenziato dopo 10 minuti', () => {
  const html = renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:05:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)
  expect(html.match(/<h3[^>]*>(.*?)<\/h3>/)![1].replace(/<[^>]+>/g,'')).toBe('Domicilio 19:30 · n. 9'); expect(html).toContain('href="tel:3331234567"'); expect(html).toContain('Via Roma 1 · Bitetto · citofono Rossi'); expect(html).toContain('Contanti (paga con 50,00 €)')
  for (const b of ['>Accetta<','Accetta +15’','Accetta +30’','>Rifiuta…<']) expect(html).toContain(b)
  expect(html).not.toContain('b-comanda--ritardo')
  expect(renderToStaticMarkup(<CardOrdineCasa ordine={casa} ora="2026-10-11T17:11:00.000Z" inCorso={false} esegui={() => {}} daAccettare />)).toContain('In attesa da più di 10 minuti')
})
it('cucina: tavoli e casa insieme per orario, con il passaggio giusto per la casa', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T17:05:00Z" dati={{ tavoli: [],riepiloghi: [],contiRecenti: [],ordiniOnline: online,
    ordini: [tavolo],casa: [{ ...casa,stato: 'accettato' },{ ...casa,id: 'c2',numero: 10,tipo: 'asporto',stato: 'pronto',fascia: '2026-10-11T17:45:00.000Z' },{ ...casa,id: 'c3',numero: 11 }] }} />)
  expect(html).toContain('Ordini online: aperti oggi'); expect(html).toContain('Domicilio: Consegne a domicilio non disponibili.')
  expect(html.indexOf('>19:30<')).toBeLessThan(html.indexOf('>Tavolo 1<'))
  expect(html).toContain('Pronti e in consegna'); expect(html).toContain('>Segna ritirato<')
  expect(html.match(/Accetta \+15/g)).toHaveLength(1)
})
it('schede: in «tavoli» si vedono i tavoli, la cucina resta montata ma nascosta; badge con gli ordini da guardare', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T18:05:00Z" vista="tavoli" dati={{ tavoli: [],ordini: [tavolo],riepiloghi: [],contiRecenti: [],casa: [casa],ordiniOnline: online }} />)
  expect(html).toContain('Nessun tavolo configurato'); expect(html).toMatch(/<section[^>]*aria-label="Ordini"[^>]*hidden=""|<section[^>]*hidden=""[^>]*aria-label="Ordini"/)
  expect(html).toMatch(/href="\/staff\?vista=tavoli"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/staff\?vista=tavoli"/); expect(html).toContain('b-badge')
})
it('tavoli: aperto con codice e riassunto, libero con «Apri tavolo», dettaglio con conto e chiusura', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const sessione = { id: 's',tavoloId: 't1',codice: '4827',apertaIl: '2026-10-11T18:05:00.000Z',tentativi: 0 }
  const tavoli = [{ id: 't1',nome: 'Tavolo 1',slug: 'tavolo-1',chiave: 'k1',posizione: 1,attivo: true,sessione },{ id: 't2',nome: 'Tavolo 2',slug: 'tavolo-2',chiave: 'k2',posizione: 2,attivo: true,sessione: null }]
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T18:10:00Z" vista="tavoli" dati={{ tavoli,ordini: [{ ...tavolo,sessioneId: 's' }],riepiloghi: [{ sessioneId: 's',numeroOrdini: 1,totaleCent: 900 }],contiRecenti: [],casa: [],ordiniOnline: online }} />)
  expect(html).toContain('aria-label="Codice 4827"'); expect(html).toContain('1 in cucina'); expect(html).toContain('1 ordini · '); expect(html).toContain('Apri tavolo'); expect(html).toContain('href="/staff/conto/s"'); expect(html).toContain('Chiudi tavolo')
})
it('conti: tavoli aperti con totale e chiusi di recente, ognuno porta al suo conto', async () => {
  const { ElencoConti } = await import('./ElencoConti')
  const html = renderToStaticMarkup(<ElencoConti aperti={[{ id: 'a',nome: 'Tavolo 4',totaleCent: 5850 }]} recenti={[{ id: 'b',nome: 'Tavolo 1',chiusaIl: '2026-10-11T18:30:00.000Z' }]} corrente="a" />)
  expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/staff\/conto\/a"|<a[^>]*href="\/staff\/conto\/a"[^>]*aria-current="page"/); expect(html).toContain('58,50'); expect(html).toContain('href="/staff/conto/b"'); expect(html).toContain('chiuso 20:30')
})
it('dettaglio del tavolo: la conferma di chiusura nomina il tavolo; tocco sul tavolo collegato al dettaglio, titolo che riceve il fuoco', async () => {
  const { VistaTavoli } = await import('./VistaTavoli')
  const sessione = { id: 's2',tavoloId: 't2',codice: '1593',apertaIl: '2026-10-11T18:05:00.000Z',tentativi: 0 }
  const tavoli = [{ id: 't2',nome: 'Tavolo 2',slug: 'tavolo-2',chiave: 'k2',posizione: 2,attivo: true,sessione }]
  const html = renderToStaticMarkup(<VistaTavoli tavoli={tavoli} riepiloghi={[]} ordini={[]} inCorso={false} esegui={() => {}} />)
  expect(html).toContain('Chiudere Tavolo 2? I clienti non potranno più ordinare.')
  expect(html).toMatch(/<aside[^>]*id="dettaglio-tavolo"/); expect(html).toMatch(/aria-controls="dettaglio-tavolo"/); expect(html).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Tavolo 2<\/h2>/)
})
it('dettaglio del tavolo: se il tavolo scelto non è più aperto non si passa da soli a un altro', async () => {
  const { tavoloDelDettaglio } = await import('./VistaTavoli')
  const aperto = (id: string) => ({ id,nome: id,slug: id,chiave: id,posizione: 1,attivo: true,sessione: { id: `s-${id}`,tavoloId: id,codice: '1111',apertaIl: '2026-10-11T18:05:00.000Z',tentativi: 0 } })
  const libero = { ...aperto('t3'),sessione: null }
  expect(tavoloDelDettaglio([aperto('t1'),aperto('t2')],null)?.id).toBe('t1')
  expect(tavoloDelDettaglio([aperto('t1'),aperto('t2')],'t2')?.id).toBe('t2')
  expect(tavoloDelDettaglio([aperto('t1'),libero],'t3')).toBeNull()
  expect(tavoloDelDettaglio([aperto('t1')],'sparito')).toBeNull()
})
it('colonne della cucina: i punti di passaggio sono in em, così col carattere più grande le colonne diventano meno', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(new URL('./staff.css',import.meta.url),'utf8')
  expect(css).toMatch(/@media \(max-width: [\d.]+em\) \{ \.b-colonne/); expect(css).not.toMatch(/@media \(max-width: \d+px\) \{ \.b-colonne/)
})
it('comanda nuova: si segna letta al clic, non alla pressione (l’etichetta che sparisce sposterebbe il bottone sotto il dito)', () => {
  const card = CardOrdine({ ordine: tavolo,ora: '2026-10-11T18:05:00Z',nuovo: true,inCorso: false,leggi: () => {},esegui: () => {} }) as React.ReactElement<{ onClick?: unknown; onPointerDown?: unknown }>
  expect(card.props.onPointerDown).toBeUndefined(); expect(card.props.onClick).toBeTypeOf('function')
})
it('tavolo chiuso: la comanda si prepara ancora ma non offre annullamenti', () => {
  const html = renderToStaticMarkup(<CardOrdine ordine={{ ...tavolo,tavoloChiuso: true }} ora="2026-10-11T18:05:00Z" nuovo={false} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).toContain('Inizia a preparare'); expect(html).toContain('Tavolo chiuso')
  expect(html).not.toContain('Annulla tutto l’ordine')
  expect(renderToStaticMarkup(<CardOrdine ordine={tavolo} ora="2026-10-11T18:05:00Z" nuovo={false} inCorso={false} leggi={() => {}} esegui={() => {}} />)).toContain('Annulla tutto l’ordine')
})
it('scheda «Menù»: interruttori Disponibile/Esaurito per lo staff, con il numero di esauriti', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const menu = [{ id: 'nigiri',nome: 'Nigiri',pezzi: null,piatti: [{ id: 'a',numero: 1,nome: 'Salmone',prezzoCent: 600,allergeniConfermati: true,disponibile: true },{ id: 'b',numero: 2,nome: 'Tonno',prezzoCent: 700,allergeniConfermati: true,disponibile: false }] }]
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T18:05:00Z" vista="menu" dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [],casa: [],ordiniOnline: online,menu }} />)
  expect(html).toMatch(/href="\/staff\?vista=menu"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/staff\?vista=menu"/)
  expect(html.match(/role="switch"/g)).toHaveLength(2); expect(html).toContain('aria-checked="false"'); expect(html).toContain('1 piatto esaurito stasera')
  expect(html).not.toContain('/admin/')
})
