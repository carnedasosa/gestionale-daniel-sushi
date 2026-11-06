import { expect, it } from 'vitest'
import { creaInvioIncasso } from './invio-incasso'

const invio = () => { let n = 0; return creaInvioIncasso(() => `chiave-${++n}`) }

it('doppio tocco: il secondo non parte finché il primo è in volo', () => {
  const i = invio()
  expect(i.parti()).toBe('chiave-1')
  expect(i.parti()).toBeNull()
})
it('incasso confermato: il prossimo ha una chiave nuova', () => {
  const i = invio()
  i.parti(); i.finito(true)
  expect(i.parti()).toBe('chiave-2')
})
it('rete caduta o esito negativo: chi riprova usa la stessa chiave, così non si incassa due volte', () => {
  const i = invio()
  i.parti(); i.finito(false)
  expect(i.parti()).toBe('chiave-1')
  i.finito(false)
  expect(i.parti()).toBe('chiave-1')
  i.finito(true)
  expect(i.parti()).toBe('chiave-2')
})
