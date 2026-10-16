import { expect, it } from 'vitest'
import { normalizzaEmail, normalizzaTelefono, totaliCasa, validaCheckout } from './checkout'
const zona = '11111111-1111-4111-8111-111111111111'
const base = { tipo: 'asporto',fascia: '2026-10-12T17:15:00.000Z',nome: ' Anna ',telefono: '333 123 4567',email: 'Anna@Esempio.IT ',pagamento: 'carta',privacy: true }
it('telefono italiano normalizzato, con o senza prefisso', () => {
  expect(normalizzaTelefono('+39 333.123-4567')).toBe('3331234567')
  expect(normalizzaTelefono('0039 080 1234567')).toBe('0801234567')
  expect(normalizzaTelefono('(080) 123456')).toBe('080123456')
  for (const t of ['12345','+41 79 123 45 67','33312345678901','333-abc-4567','',null]) expect(normalizzaTelefono(t)).toBeNull()
})
it('email in minuscolo e con un formato plausibile', () => {
  expect(normalizzaEmail(' Anna@Esempio.IT ')).toBe('anna@esempio.it')
  for (const e of ['anna@esempio','anna esempio@x.it','@x.it','a'.repeat(250) + '@x.it',3]) expect(normalizzaEmail(e)).toBeNull()
})
it('asporto valido: i campi del domicilio si ignorano', () => {
  expect(validaCheckout({ ...base,zonaId: 'x',indirizzo: '' })).toEqual({ ok: true,dati: {
    tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: new Date('2026-10-12T17:15:00.000Z'),
    nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null,
  },forzaFascia: false })
})
it('domicilio con contanti: zona, indirizzo, note e banconota', () => {
  const e = validaCheckout({ ...base,tipo: 'domicilio',zonaId: zona,indirizzo: ' Via Roma 1 ',noteConsegna: ' citofono Rossi ',pagamento: 'contanti',contantiDa: '50' })
  expect(e).toMatchObject({ ok: true,dati: { zonaId: zona,indirizzo: 'Via Roma 1',noteConsegna: 'citofono Rossi',contantiDaCent: 5000 } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: '' })).toMatchObject({ ok: true,dati: { contantiDaCent: null } })
})
it('ogni campo sbagliato ha il suo messaggio', () => {
  const e = validaCheckout({ tipo: 'domicilio',zonaId: 'x',indirizzo: 'via',noteConsegna: 'x'.repeat(201),fascia: '2026-10-12 19:15',nome: '',telefono: '1',email: 'x',pagamento: 'bonifico',privacy: 'on' })
  expect(e.ok).toBe(false)
  if (!e.ok) expect(Object.keys(e.errori).sort()).toEqual(['email','fascia','indirizzo','nome','noteConsegna','pagamento','privacy','telefono','zonaId'])
  expect(validaCheckout({ ...base,tipo: 'tavolo' })).toMatchObject({ ok: false,errori: { tipo: expect.any(String) } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: '600' })).toMatchObject({ ok: false,errori: { contantiDa: expect.any(String) } })
  expect(validaCheckout({ ...base,pagamento: 'contanti',contantiDa: 'cinquanta' })).toMatchObject({ ok: false,errori: { contantiDa: expect.any(String) } })
})
it('totali con consegna e importo mancante al minimo della zona', () => {
  expect(totaliCasa(1800,'domicilio',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 1800,consegnaCent: 200,totaleCent: 2000,mancanteCent: 200 })
  expect(totaliCasa(2500,'domicilio',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 2500,consegnaCent: 200,totaleCent: 2700,mancanteCent: 0 })
  expect(totaliCasa(1800,'asporto',{ costoCent: 200,minimoCent: 2000 })).toEqual({ righeCent: 1800,consegnaCent: 0,totaleCent: 1800,mancanteCent: 0 })
})
it('dalla cassa: email facoltativa, niente privacy, orario forzabile', () => {
  const cassa = { tipo: 'asporto',fascia: '2026-10-12T17:15:00.000Z',nome: 'Anna',telefono: '3331234567',pagamento: 'contanti' }
  expect(validaCheckout(cassa,{ origine: 'cassa' })).toMatchObject({ ok: true,dati: { email: null },forzaFascia: false })
  expect(validaCheckout({ ...cassa,email: '  ',forzaFascia: true },{ origine: 'cassa' })).toMatchObject({ ok: true,dati: { email: null },forzaFascia: true })
  expect(validaCheckout({ ...cassa,email: 'Anna@Esempio.it' },{ origine: 'cassa' })).toMatchObject({ ok: true,dati: { email: 'anna@esempio.it' } })
  expect(validaCheckout({ ...cassa,email: 'non-valida' },{ origine: 'cassa' })).toMatchObject({ ok: false,errori: { email: expect.any(String) } })
  // Dal cliente niente cambia: email e privacy restano obbligatorie e la forzatura si ignora.
  expect(validaCheckout({ ...cassa,forzaFascia: true })).toMatchObject({ ok: false,errori: { email: expect.any(String),privacy: expect.any(String) } })
  expect(validaCheckout({ ...base,forzaFascia: true })).toMatchObject({ ok: true,forzaFascia: false })
})
