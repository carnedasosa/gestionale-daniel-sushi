import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./azioni', () => ({ apriTavolo: vi.fn(), chiudiTavolo: vi.fn(), avanzaOrdine: vi.fn(), annullaOrdineStaff: vi.fn(), annullaRigaStaff: vi.fn() }))
import { CardOrdine } from './SchermoStaff'
it('evidenzia note e poke, barra annullati e mostra tempo e stato', () => {
  const html = renderToStaticMarkup(<CardOrdine ordine={{ id: 'o',numero: 8,stato: 'inviato',totaleCent: 900,creatoIl: '2026-10-11T18:00:00Z',sessioneId: 's',tavoloNome: 'Tavolo 1',tavoloChiuso: false,righe: [{ id: 'r',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: 'senza sesamo',poke: { Base: ['Riso'],Proteine: ['Tonno'] },annullata: false },{ id: 'r2',numero: 2,nome: 'Salmone',prezzoUnitCent: 600,quantita: 1,nota: null,poke: null,annullata: true }] }} ora="2026-10-11T18:05:00Z" nuovo={true} inCorso={false} leggi={() => {}} esegui={() => {}} />)
  expect(html).toContain('staff-ordine--nuovo'); expect(html).toContain('senza sesamo'); expect(html).toContain('staff-nota'); expect(html).toContain('Tonno'); expect(html).toContain('<s>'); expect(html).toContain('5 min'); expect(html).toContain('In preparazione')
})
it('senza dati e senza dati precedenti mostra il caricamento invece di smontarsi', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  expect(renderToStaticMarkup(<SchermoStaff dati={null} ora="2026-10-11T18:05:00Z" />)).toContain('Caricamento dello schermo')
  const html = renderToStaticMarkup(<SchermoStaff dati={{ tavoli: [],ordini: [],riepiloghi: [],contiRecenti: [] }} ora="2026-10-11T18:05:00Z" />)
  expect(html).toContain('Cucina'); expect(html).toContain('Nessun tavolo configurato')
})
