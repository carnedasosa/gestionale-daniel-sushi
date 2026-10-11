import { describe, expect, it } from 'vitest'
import { destinazioneDopoLogin, haAccesso, ruoloRichiesto } from './regole'

describe('ruoloRichiesto', () => {
  it.each([
    ['/admin', 'admin'], ['/admin/menu', 'admin'], ['/admin/menu/123', 'admin'],
    ['/staff', 'staff'], ['/staff/tavoli', 'staff'],
    ['/', null], ['/accesso', null], ['/administrator', null], ['/staffetta', null], ['/tavolo/1', null],
  ])('%s → %s', (path, atteso) => {
    expect(ruoloRichiesto(path)).toBe(atteso)
  })
})

describe('haAccesso', () => {
  it('admin entra ovunque, staff solo nello staff', () => {
    expect(haAccesso('admin', 'admin')).toBe(true)
    expect(haAccesso('staff', 'admin')).toBe(true)
    expect(haAccesso('staff', 'staff')).toBe(true)
    expect(haAccesso('admin', 'staff')).toBe(false)
  })
  it('senza ruolo non si entra', () => {
    expect(haAccesso('staff', null)).toBe(false)
    expect(haAccesso('admin', null)).toBe(false)
  })
})

describe('destinazioneDopoLogin', () => {
  it('rispetta un next interno e consentito', () => {
    expect(destinazioneDopoLogin('/admin/menu', 'admin')).toBe('/admin/menu')
    expect(destinazioneDopoLogin('/staff', 'admin')).toBe('/staff')
  })
  it('ignora next esterni o sospetti', () => {
    for (const next of ['//sito-cattivo.it', 'https://sito-cattivo.it', '/\\sito-cattivo.it', 'javascript:alert(1)', '', null, undefined]) {
      expect(destinazioneDopoLogin(next, 'admin')).toBe('/admin')
    }
  })
  it('ignora next non consentiti al ruolo o fuori dal gestionale', () => {
    expect(destinazioneDopoLogin('/admin/menu', 'staff')).toBe('/staff')
    expect(destinazioneDopoLogin('/', 'staff')).toBe('/staff')
  })
})
