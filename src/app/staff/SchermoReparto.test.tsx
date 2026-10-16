import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(),replace: vi.fn() }) }))
vi.mock('./azioni-comande', () => ({ avanzaComandaStaff: vi.fn(),portaComandaStaff: vi.fn() }))
vi.mock('./azioni-postazione', () => ({ impostaPostazione: vi.fn() }))
vi.mock('./azioni-menu', () => ({ cambiaDisponibilitaStaff: vi.fn() }))
import type { ComandaClient } from '@/comande/comande-repo'
import { CardComanda } from './CardComanda'
import { SchermoReparto } from './SchermoReparto'
const riga = (id: string, nome: string, reparto: 'banco' | 'cucina' | 'sala') => ({ id,numero: 1,nome,prezzoUnitCent: 600,quantita: 2,nota: null,poke: null,annullata: false,reparto })
const tavolo: ComandaClient = { id: 'c1',reparto: 'banco',stato: 'da_preparare',creataIl: '2026-10-11T18:00:00.000Z',ordineId: 'o1',numero: 12,tipo: 'tavolo',origine: 'cliente',
  tavoloNome: 'Tavolo 3',tavoloChiuso: false,fascia: null,creatoIl: '2026-10-11T18:00:00.000Z',righe: [riga('r1','Salmone','banco')],altreRighe: [{ reparto: 'cucina',n: 2 },{ reparto: 'sala',n: 1 }] }
const asporto: ComandaClient = { ...tavolo,id: 'c2',stato: 'in_preparazione',ordineId: 'o2',numero: 9,tipo: 'asporto',origine: 'cassa',tavoloNome: null,fascia: '2026-10-11T17:30:00.000Z',altreRighe: [] }
const titolo = (html: string) => html.match(/<h3[^>]*>(.*?)<\/h3>/)![1].replace(/<[^>]+>/g,'')
it('comanda del tavolo: titolo come le card della cassa, righe del reparto, piatti degli altri reparti, primo passo', () => {
  const html = renderToStaticMarkup(<CardComanda comanda={tavolo} ora="2026-10-11T18:05:00Z" nuova inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(titolo(html)).toBe('Tavolo 3 · n. 12')
  expect(html).toContain('<article'); expect(html).toContain('Salmone'); expect(html).toContain('Nuova comanda'); expect(html).toContain('aria-label="5 min"')
  expect(html).toContain('+ 2 piatti in cucina'); expect(html).not.toContain('da portare')
  expect(html).toContain('>Inizia a preparare<'); expect(html).not.toContain('Annulla')
})
it('comanda da casa: «Asporto 19:30 · n. 9», chip della cassa e «Segna pronta»', () => {
  const html = renderToStaticMarkup(<CardComanda comanda={asporto} ora="2026-10-11T18:05:00Z" nuova={false} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(titolo(html)).toBe('Asporto 19:30 · n. 9'); expect(html).toContain('Dalla cassa'); expect(html).toContain('>Segna pronta<'); expect(html).toContain('b-comanda--preparazione')
})
it('comanda pronta: nessun bottone, aspetta gli altri reparti', () => {
  const html = renderToStaticMarkup(<CardComanda comanda={{ ...tavolo,stato: 'pronta' }} ora="2026-10-11T18:05:00Z" nuova={false} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).not.toContain('<button'); expect(html).toContain('l’ordine aspetta cucina')
})
it('schermo del banco: tre colonne, solo le sue comande, niente «Da accettare», schede Ordini e Menù', () => {
  const html = renderToStaticMarkup(<SchermoReparto postazione="banco" ora="2026-10-11T18:05:00Z" dati={{ comande: [tavolo,asporto,{ ...tavolo,id: 'c3',stato: 'pronta',numero: 13 }] }} />)
  for (const t of ['Da preparare','In preparazione','Pronte']) expect(html).toContain(`>${t} <`)
  expect(html).not.toContain('Da accettare'); expect(html).not.toContain('Ordini online'); expect(html).not.toContain('Nuovo ordine')
  expect(html).toContain('Staff · Banco sushi'); expect(html).toContain('href="/staff?vista=menu"'); expect(html).not.toContain('href="/staff?vista=tavoli"')
  expect(html.match(/<article/g)).toHaveLength(3)
})
it('schermo della cucina senza dati: caricamento, senza smontarsi', () => {
  expect(renderToStaticMarkup(<SchermoReparto postazione="cucina" ora="2026-10-11T18:05:00Z" dati={null} />)).toContain('Caricamento dello schermo')
})
