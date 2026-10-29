import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { leggiFoto, salvaFoto, togliFoto } from './foto-repo'
import { leggiMenu, leggiPiatto } from './repo'

let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, piatto: string
beforeEach(async () => {
  ambiente = await creaDbDiTest({ seed: true })
  piatto = (await ambiente.db.query<{ id: string }>('select id from piatti where numero=1'))[0].id
})
afterEach(async () => { await ambiente.pg.close() })
// Un JPEG finto: basta l'intestazione giusta, la tabella non decodifica l'immagine.
const jpeg = (riempi = 1) => new Uint8Array([0xff,0xd8,0xff,0xe0,...new Array(300).fill(riempi)])

it('salva, legge per versione, sostituisce e toglie la foto; il menù vede solo versione e dimensioni', async () => {
  const { db } = ambiente
  const a = await salvaFoto(db,piatto,jpeg(1),800,600)
  if (!a.ok) throw new Error(a.errore)
  expect(a.foto).toMatchObject({ larghezza: 800,altezza: 600 })
  expect(a.foto.versione).toMatch(/^[0-9a-f]{16}$/)
  const letta = (await leggiFoto(db,piatto,a.foto.versione))!
  expect(letta.tipo).toBe('image/jpeg')
  expect(Array.from(letta.dati)).toEqual(Array.from(jpeg(1)))
  expect((await leggiPiatto(db,piatto))!.foto).toEqual(a.foto)
  expect((await leggiMenu(db)).flatMap(c => c.piatti).filter(p => p.foto)).toHaveLength(1)
  const b = await salvaFoto(db,piatto,jpeg(2),640,480)
  if (!b.ok) throw new Error(b.errore)
  expect(b.foto.versione).not.toBe(a.foto.versione)
  expect(await leggiFoto(db,piatto,a.foto.versione)).toBeNull()
  expect(await togliFoto(db,piatto)).toBe(true)
  expect(await togliFoto(db,piatto)).toBe(false)
  expect((await leggiPiatto(db,piatto))!.foto).toBeNull()
})
it('rifiuta formati, pesi, dimensioni e piatti non validi', async () => {
  const { db } = ambiente
  const testo = new TextEncoder().encode('non è una foto'.padEnd(200,' '))
  expect(await salvaFoto(db,piatto,testo,800,600)).toMatchObject({ ok: false,errore: expect.stringContaining('Formato') })
  expect(await salvaFoto(db,piatto,new Uint8Array([0xff,0xd8,0xff,...new Array(410 * 1024).fill(0)]),800,600)).toMatchObject({ ok: false,errore: expect.stringContaining('400 KB') })
  expect(await salvaFoto(db,piatto,jpeg(),5000,600)).toMatchObject({ ok: false })
  expect(await salvaFoto(db,randomUUID(),jpeg(),800,600)).toEqual({ ok: false,errore: 'Piatto non trovato.' })
  expect(await salvaFoto(db,'x',jpeg(),800,600)).toMatchObject({ ok: false })
  expect(await leggiFoto(db,piatto,'../../etc')).toBeNull()
})
it('la foto se ne va con il piatto', async () => {
  const { db } = ambiente
  await salvaFoto(db,piatto,jpeg(),800,600)
  await db.query('delete from piatti where id=$1',[piatto])
  expect(await db.query('select 1 from foto_piatti')).toHaveLength(0)
})
