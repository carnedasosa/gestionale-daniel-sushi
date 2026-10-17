import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { AvvisoEmail } from './AvvisoEmail'
it('avviso email: senza email in errore non rende nulla', () => {
  expect(renderToStaticMarkup(<AvvisoEmail errori={{ n: 0,ultimoErrore: null,ultimaIl: null }} />)).toBe('')
})
it('avviso email: conteggio, ultimo errore e ora di Roma, con l’invito a contattare i clienti', () => {
  const html = renderToStaticMarkup(<AvvisoEmail errori={{ n: 2,ultimoErrore: 'Resend 429: limite superato',ultimaIl: new Date('2026-10-12T19:05:00Z') }} />)
  expect(html).toContain('role="alert"'); expect(html).toContain('Email ai clienti')
  expect(html).toContain('2 email non sono partite dopo 5 tentativi.')
  expect(html).toContain('Resend 429: limite superato')
  expect(html).toContain('12/10/2026 alle 21:05')
  expect(html).toContain('contatta a mano')
})
it('avviso email: al singolare con una sola email', () => {
  expect(renderToStaticMarkup(<AvvisoEmail errori={{ n: 1,ultimoErrore: 'Ordine non disponibile',ultimaIl: new Date('2026-01-15T12:00:00Z') }} />)).toContain('1 email non è partita dopo 5 tentativi.')
})
