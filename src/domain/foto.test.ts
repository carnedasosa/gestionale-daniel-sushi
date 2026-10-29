import { expect, it } from 'vitest'
import { dimensioniRidotte, dimensioneValida, tipoFoto, urlFoto, versioneValida } from './foto'

const byte = (...b: number[]) => new Uint8Array([...b,...new Array(20).fill(0)])
it('riconosce WebP, JPEG e PNG dai primi byte e rifiuta il resto', () => {
  expect(tipoFoto(byte(0x52,0x49,0x46,0x46,1,2,3,4,0x57,0x45,0x42,0x50))).toBe('image/webp')
  expect(tipoFoto(byte(0xff,0xd8,0xff,0xe0))).toBe('image/jpeg')
  expect(tipoFoto(byte(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))).toBe('image/png')
  expect(tipoFoto(byte(0x47,0x49,0x46,0x38))).toBeNull() // GIF
  expect(tipoFoto(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  expect(tipoFoto(new Uint8Array([0xff,0xd8]))).toBeNull()
})
it('riduce il lato lungo a 800 senza ingrandire', () => {
  expect(dimensioniRidotte(4000,3000)).toEqual({ larghezza: 800,altezza: 600 })
  expect(dimensioniRidotte(1080,1920)).toEqual({ larghezza: 450,altezza: 800 })
  expect(dimensioniRidotte(640,480)).toEqual({ larghezza: 640,altezza: 480 })
})
it('valida dimensioni, versione e indirizzo', () => {
  expect(dimensioneValida(800)).toBe(true); expect(dimensioneValida(15)).toBe(false); expect(dimensioneValida(2001)).toBe(false); expect(dimensioneValida(1.5)).toBe(false)
  expect(versioneValida('0123456789abcdef')).toBe(true); expect(versioneValida('0123456789ABCDEF')).toBe(false); expect(versioneValida('../x')).toBe(false)
  expect(urlFoto('p','0123456789abcdef')).toBe('/foto/p/0123456789abcdef')
})
