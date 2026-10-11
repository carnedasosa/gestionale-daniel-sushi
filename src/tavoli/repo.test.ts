import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, aggiornaTavolo, chiudiSessione, contaErrori, creaTavolo, elencoTavoli, registraTentativoFallito, sessioneApertaPerId, tavoloDaSlug, verificaCodice } from './repo'

let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest() })
afterEach(async () => { await ambiente.pg.close() })
it('crea tavoli, ordina e valida slug e id', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'Tavolo 1', 'tavolo-1')
  expect(await tavoloDaSlug(db, t.slug)).toEqual(t)
  await expect(creaTavolo(db, 'Duplicato', t.slug)).rejects.toThrow()
  expect(await elencoTavoli(db)).toEqual([{ ...t, sessione: null }])
  expect(await tavoloDaSlug(db, '../')).toBeNull()
  expect(await aggiornaTavolo(db, 'x', { nome: 'X', attivo: false, posizione: 0 })).toBeNull()
  expect(await chiudiSessione(db, 'x')).toBe(false)
  expect(await sessioneApertaPerId(db, 'x')).toBeNull()
  expect(await verificaCodice(db, 'x', '1234')).toBeNull()
})
it('apertura idempotente, collisioni, indici unici e riuso dei codici chiusi', async () => {
  const { db } = ambiente
  const a = await creaTavolo(db, 'A', 'a'), b = await creaTavolo(db, 'B', 'b')
  const s = await apriSessione(db, a.id, () => '1234')
  expect((await apriSessione(db, a.id)).id).toBe(s.id)
  const codici = ['1234', '1234', '5678']
  expect((await apriSessione(db, b.id, () => codici.shift()!)).codice).toBe('5678')
  await expect(db.query('insert into sessioni_tavolo(tavolo_id,codice) values ($1,$2)', [a.id, '4321'])).rejects.toThrow()
  expect(await verificaCodice(db, a.id, '1234')).toMatchObject({ id: s.id })
  expect(await verificaCodice(db, a.id, '0000')).toBeNull()
  expect(await aggiornaTavolo(db, a.id, { nome: 'A', attivo: false, posizione: 0 })).toBeNull()
  await chiudiSessione(db, s.id)
  expect(await verificaCodice(db, a.id, '1234')).toBeNull()
  const c = await creaTavolo(db, 'C', 'c')
  expect((await apriSessione(db, c.id, () => '1234')).codice).toBe('1234')
})
it('conta errori solo nella finestra e per dispositivo', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'A', 'a'), dispositivo = randomUUID()
  await registraTentativoFallito(db, t.id, dispositivo)
  await registraTentativoFallito(db, t.id, randomUUID())
  await db.query("insert into tentativi_codice(tavolo_id,dispositivo,creato_il) values ($1,$2,now()-interval '11 minutes')", [t.id, dispositivo])
  expect(await contaErrori(db, t.id, dispositivo, 10)).toEqual({ dispositivo: 1, tavolo: 2 })
})
it('le nuove tabelle hanno RLS e nessun privilegio API', async () => {
  const { db } = ambiente
  const tabelle = ['tavoli', 'sessioni_tavolo', 'tentativi_codice', 'ordini', 'righe_ordine']
  for (const nome of tabelle) {
    const [r] = await db.query<{ rls: boolean; permesso: boolean }>("select relrowsecurity as rls, has_table_privilege('authenticated',oid,'select') as permesso from pg_class where relname=$1", [nome])
    expect(r).toEqual({ rls: true, permesso: false })
  }
})
