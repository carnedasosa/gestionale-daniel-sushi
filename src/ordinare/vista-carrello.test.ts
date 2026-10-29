import { expect, it } from 'vitest'
import { totaleVista, vistaCarrello } from './vista-carrello'
import type { Piatto } from '@/menu/repo'
const piatto: Piatto = { id: '11111111-1111-4111-8111-111111111111',categoriaId: 'c',numero: 1,nome: 'Salmone',descrizione: null,prezzoCent: 600,piccante: false,vegetariano: false,dellaCasa: false,allergeni: [],allergeniConfermati: true,disponibile: true,posizione: 0,foto: null }
const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
it('nomi e prezzi stimati, piatti spariti e poke da ricomporre', () => {
  const righe = [{ piattoId: piatto.id,quantita: 2,nota: '' },{ piattoId: '22222222-2222-4222-8222-222222222222',quantita: 1,nota: '' },{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] } },{ piattoId: null,quantita: 1,nota: '',poke: { Base: [] } }]
  const vista = vistaCarrello(righe,[piatto],config)
  expect(vista.map(r => [r.nome,r.prezzoCent,r.daRicomporre])).toEqual([['Salmone',600,false],['Piatto non più in menù',0,false],['Poke composta',900,false],['Poke composta',0,true]])
  expect(totaleVista(vista)).toBe(2100)
  expect(vistaCarrello(righe.slice(2,3),[],null)[0]).toMatchObject({ daRicomporre: true,prezzoCent: 0 })
})
