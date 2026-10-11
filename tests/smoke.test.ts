import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('design system', () => {
  it('i token del sito sono presenti nell’app', () => {
    const css = readFileSync('src/styles/ds/tokens.css', 'utf8')
    expect(css).toContain('--indaco: #234386')
    expect(css).toContain('--carta: #FBF9F6')
  })
})
