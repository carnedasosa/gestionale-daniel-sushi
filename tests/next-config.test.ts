import { describe, expect, it } from 'vitest'
import config from '../next.config'

async function intestazioni() {
  const regole = await config.headers!()
  expect(regole).toHaveLength(1)
  expect(regole[0].source).toBe('/(.*)')
  return Object.fromEntries(regole[0].headers.map(h => [h.key,h.value]))
}

describe('header di sicurezza', () => {
  it('niente x-powered-by', () => { expect(config.poweredByHeader).toBe(false) })
  it('tutte le pagine hanno gli header', async () => {
    expect(await intestazioni()).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    })
  })
  it('Permissions-Policy nega camera, microfono e posizione, non wake lock né audio dello schermo staff', async () => {
    const politica = (await intestazioni())['Permissions-Policy']
    expect(politica.split(', ').sort()).toEqual(['camera=()','geolocation=()','microphone=()'])
    expect(politica).not.toMatch(/screen-wake-lock|autoplay|speaker/)
  })
  it('la CSP è solo in osservazione, su una riga, senza eval in produzione', async () => {
    const h = await intestazioni()
    expect(h).not.toHaveProperty('Content-Security-Policy')
    const csp = h['Content-Security-Policy-Report-Only']
    expect(csp).not.toMatch(/\n/)
    expect(csp).not.toContain('unsafe-eval')
    const direttive = Object.fromEntries(csp.split('; ').map(d => [d.split(' ')[0],d.split(' ').slice(1).join(' ')]))
    expect(direttive).toMatchObject({ 'default-src': "'self'",'connect-src': "'self'",'object-src': "'none'",'base-uri': "'self'",'form-action': "'self'",'frame-ancestors': "'none'" })
    // Le foto del menù e i QR passano da qui: stessa origine, più i data: dei QR.
    expect(direttive['img-src']).toContain("'self'")
    expect(direttive['img-src']).toContain('data:')
  })
})
