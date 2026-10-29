import { expect, it } from 'vitest'
import { ETICHETTA_POSTAZIONE, nuovoOrdineAmmesso, onlineAmmesso, OPZIONI_COOKIE_POSTAZIONE, POSTAZIONI, postazioneDa, postazioneValida, repartoDellaPostazione, schedePostazione, accettareAmmesso } from './postazioni'
it('postazioni ammesse ed etichette', () => {
  expect(['cassa','banco','cucina','sala'].every(postazioneValida)).toBe(true)
  expect([null,undefined,'bar',1,['banco']].some(postazioneValida)).toBe(false)
  expect(ETICHETTA_POSTAZIONE).toEqual({ cassa: 'Cassa',banco: 'Banco sushi',cucina: 'Cucina',sala: 'Sala' })
})
it('precedenza: la query vince sul cookie, poi il cookie, poi la cassa', () => {
  expect(postazioneDa('banco','cucina')).toBe('banco')
  expect(postazioneDa(undefined,'cucina')).toBe('cucina')
  expect(postazioneDa('bar','sala')).toBe('sala')
  expect(postazioneDa(['banco'],undefined)).toBe('cassa')
  expect(postazioneDa(undefined,'xx')).toBe('cassa')
})
it('schede, reparto e permessi per postazione', () => {
  expect(schedePostazione('cassa')).toEqual(['ordini','tavoli','conti','menu'])
  expect(schedePostazione('banco')).toEqual(['ordini','menu'])
  expect(schedePostazione('cucina')).toEqual(['ordini','menu'])
  expect(schedePostazione('sala')).toEqual(['ordini','tavoli','conti'])
  expect(POSTAZIONI.map(repartoDellaPostazione)).toEqual([null,'banco','cucina',null])
  for (const f of [accettareAmmesso,onlineAmmesso,nuovoOrdineAmmesso]) expect(POSTAZIONI.map(p => f(p))).toEqual([true,false,false,false])
})
it('cookie solo sotto /staff, per un anno, non leggibile dal browser', () => {
  expect(OPZIONI_COOKIE_POSTAZIONE).toEqual({ path: '/staff',sameSite: 'lax',httpOnly: true,maxAge: 31536000 })
})
