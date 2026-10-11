import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('design system', () => {
  it('mantiene l’accento del locale sul fondo raggruppato HIG', () => {
    const css = readFileSync('src/styles/ds/tokens.css', 'utf8')
    expect(css).toContain('--indaco: #234386')
    expect(css).toContain('--carta: #f2f2f7')
  })
})
