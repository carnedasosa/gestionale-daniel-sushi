import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('design system', () => {
  it('il layout carica i token Banco e la carta ha il suo colore', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    const token = readFileSync('src/styles/banco/token.css', 'utf8')
    expect(layout).toContain("import '@/styles/banco/token.css'")
    expect(layout).not.toContain('styles/ds/')
    expect(token).toContain('--b-carta: #F3EFE6')
    expect(token).toContain('--b-inchiostro: #1C1B18')
  })
})
