import { expect, it } from 'vitest'
import { ripristinaCarrello, aggiornaCarrello, pokeDaRicomporre } from './carrello-salvato'
const key = '11111111-1111-4111-8111-111111111111'
const altra = '22222222-2222-4222-8222-222222222222'
const righe = [{ piattoId: key,quantita: 1,nota: '' }]
it('conserva la chiave nei retry e la cambia solo quando il carrello cambia', () => {
  const c = ripristinaCarrello(JSON.stringify({ righe,chiaveInvio: key }),() => altra)
  expect(c).toEqual({ righe,chiaveInvio: key })
  expect(aggiornaCarrello(c,[...righe],() => altra)).toBe(c)
  expect(aggiornaCarrello(c,[{ ...righe[0],nota: 'nota' }],() => altra).chiaveInvio).toBe(altra)
  expect(aggiornaCarrello(c,[],() => altra).chiaveInvio).toBeNull()
  expect(ripristinaCarrello(JSON.stringify(righe),() => altra).chiaveInvio).toBe(altra)
  expect(ripristinaCarrello('{',() => altra).righe).toEqual([])
})
it('blocca la poke non più valida dopo un cambio di regole o prezzi', () => {
  const r = [{ piattoId: null,quantita: 1,nota: '',poke: { Base: ['Riso'] } }]
  const c = { titolo: 'Poke',prezzoBaseCent: 900,prezzoExtraCent: 100,gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 }] }
  expect(pokeDaRicomporre(r,c)).toEqual([])
  expect(pokeDaRicomporre(r,{ ...c,prezzoBaseCent: null })).toEqual([0])
  expect(pokeDaRicomporre(r,{ ...c,gruppi: [{ ...c.gruppi[0],voci: ['Quinoa'] }] })).toEqual([0])
  expect(pokeDaRicomporre(r,null)).toEqual([0])
})
