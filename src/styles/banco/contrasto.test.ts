import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
// Ogni coppia testo/sfondo dei token Banco deve leggersi bene (WCAG AA, 4,5:1) in chiaro e in scuro.
const css = readFileSync(join(__dirname,'token.css'),'utf8')
const [chiaro,scuro] = css.split('@media (prefers-color-scheme: dark)')
const leggi = (blocco: string) => Object.fromEntries([...blocco.matchAll(/--b-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1],m[2]]))
const luminanza = (hex: string) => {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i + 2),16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}
const rapporto = (a: string, b: string) => { const [x,y] = [luminanza(a),luminanza(b)].sort((p,q) => q - p); return (x + .05) / (y + .05) }
const COPPIE: [string,string][] = [
  ['inchiostro','carta'],['inchiostro','foglio'],['inchiostro','campo'],['grafite','carta'],['grafite','foglio'],['su-inchiostro','inchiostro'],
  ...['accettare','preparare','preparazione','pronto','ritardo'].map(t => [`st-${t}-testo`,`st-${t}-sfondo`] as [string,string]),
  ['su-pieno','pericolo-pieno'],['su-pieno','accettare-pieno'],['pericolo-testo','foglio'],['pericolo-testo','carta'],
  ['nota-testo','nota-sfondo'],['su-barra','barra'],
]
for (const [nome,blocco] of [['chiaro',chiaro],['scuro',scuro]] as const) {
  it(`contrasto dei testi ≥ 4,5:1 (${nome})`, () => {
    const t = { ...leggi(chiaro),...leggi(blocco) }
    for (const [testo,sfondo] of COPPIE) {
      expect(t[testo],`--b-${testo}`).toBeDefined(); expect(t[sfondo],`--b-${sfondo}`).toBeDefined()
      expect(rapporto(t[testo],t[sfondo]),`${testo} su ${sfondo}`).toBeGreaterThanOrEqual(4.5)
    }
  })
}
