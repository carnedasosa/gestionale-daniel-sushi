import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('design system', () => {
  it('applica i token Cupertino attraverso gli alias del gestionale', () => {
    const css = readFileSync('src/styles/ds/tokens.css', 'utf8')
    const cupertino = readFileSync('src/styles/ds/cupertino.css', 'utf8')
    expect(css).toContain('--indaco: var(--accent-text)')
    expect(css).toContain('--carta: var(--bg-grouped)')
    expect(cupertino).toContain('--accent: #1e6ef4')
    expect(cupertino).toContain('--bg-grouped: #f2f2f7')
  })
})
