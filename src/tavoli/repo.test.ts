import { afterEach, beforeEach, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { bloccato } from '@/domain/limiti-tentativi'
import { creaDbDiTest } from '../../tests/db/pglite'
import { apriSessione, aggiornaTavolo, chiudiSessione, contaErrori, creaTavolo, elencoTavoli, registraTentativoFallito, sessioneApertaPerId, tavoloDaChiave, verificaCodice, rigeneraChiave, sbloccaSessione } from './repo'

let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => { ambiente = await creaDbDiTest() })
afterEach(async () => { await ambiente.pg.close() })
it('crea tavoli, ordina e valida slug e id', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'Tavolo 1', 'tavolo-1')
  expect(await tavoloDaChiave(db, t.chiave)).toEqual(t)
  await expect(creaTavolo(db, 'Duplicato', t.slug)).rejects.toThrow()
  expect(await elencoTavoli(db)).toEqual([{ ...t, sessione: null }])
  expect(await tavoloDaChiave(db, '../')).toBeNull()
  expect(await tavoloDaChiave(db, t.slug)).toBeNull()
  const nuova = (await rigeneraChiave(db,t.id))!
  expect(nuova.chiave).not.toBe(t.chiave)
  expect(await tavoloDaChiave(db,t.chiave)).toBeNull()
  expect(await aggiornaTavolo(db, 'x', { nome: 'X', attivo: false, posizione: 0 })).toBeNull()
  expect(await chiudiSessione(db, 'x')).toMatchObject({ ok: false })
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
it('limite end-to-end su repo reale: dispositivo, IP, finestra, sblocco e riapertura', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'A', 'a'), dispositivo = randomUUID()
  const s = await apriSessione(db,t.id)
  const ip = '192.0.2.1'
  for (let i=0; i<5; i++) await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo,ip })
  await db.query("insert into tentativi_codice(tavolo_id,sessione_id,dispositivo,ip,creato_il) values ($1,$2,$3,$4,now()-interval '11 minutes')",[t.id,s.id,dispositivo,ip])
  expect(await contaErrori(db,{ sessioneId: s.id,dispositivo,ip,minuti: 10 })).toEqual({ dispositivo: 5,ip: 5,sessione: 5 })
  const entra = async (d: string,i: string) => !bloccato(await contaErrori(db,{ sessioneId: s.id,dispositivo: d,ip: i,minuti: 10 })) && !!await verificaCodice(db,t.id,s.codice)
  expect(await entra(dispositivo,'192.0.2.2')).toBe(false)
  expect(await entra(randomUUID(),ip)).toBe(false)
  expect(await entra(randomUUID(),'192.0.2.2')).toBe(true)
  await sbloccaSessione(db,s.id)
  expect(await entra(dispositivo,ip)).toBe(true)
  await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo,ip })
  await chiudiSessione(db,s.id)
  const riaperta = await apriSessione(db,t.id)
  expect(await contaErrori(db,{ sessioneId: riaperta.id,dispositivo,ip,minuti: 10 })).toEqual({ dispositivo: 0,ip: 0,sessione: 0 })
})
it('senza indirizzo conta solo dispositivo e sessione; a trenta errori blocca anche chi è nuovo', async () => {
  const { db } = ambiente
  const t = await creaTavolo(db, 'B', 'b'), s = await apriSessione(db,t.id)
  for (let i=0; i<5; i++) await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo: randomUUID(),ip: null })
  // Cinque telefoni senza indirizzo non bloccano un sesto telefono senza indirizzo.
  expect(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: null,minuti: 10 })).toEqual({ dispositivo: 0,ip: 0,sessione: 5 })
  for (let i=0; i<25; i++) await registraTentativoFallito(db,{ tavoloId: t.id,sessioneId: s.id,dispositivo: randomUUID(),ip: `2001:db8:${i}:0::/64` })
  expect(bloccato(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: '2001:db8:ff:0::/64',minuti: 10 }))).toBe(true)
  await sbloccaSessione(db,s.id)
  expect(bloccato(await contaErrori(db,{ sessioneId: s.id,dispositivo: randomUUID(),ip: null,minuti: 10 }))).toBe(false)
})
it('le nuove tabelle hanno RLS e nessun privilegio API', async () => {
  const { db } = ambiente
  const tabelle = ['tavoli', 'sessioni_tavolo', 'tentativi_codice', 'ordini', 'righe_ordine']
  for (const nome of tabelle) {
    const [r] = await db.query<{ rls: boolean; permesso: boolean }>("select relrowsecurity as rls, has_table_privilege('authenticated',oid,'select') as permesso from pg_class where relname=$1", [nome])
    expect(r).toEqual({ rls: true, permesso: false })
  }
})
it('due aperture in sequenza riusano una sola sessione e mantengono codici distinti', async () => {
  const { db } = ambiente
  const a = await creaTavolo(db,'A','a'), b = await creaTavolo(db,'B','b')
  // PGlite serializza le transazioni: questo test non prova la concorrenza reale.
  // Su Postgres la garanzia resta negli indici unici e nei lock FOR UPDATE.
  const s1 = await apriSessione(db,a.id), s2 = await apriSessione(db,a.id)
  expect(s1.id).toBe(s2.id)
  const s3 = await apriSessione(db,b.id)
  expect(s3.codice).not.toBe(s1.codice)
  await chiudiSessione(db,s1.id)
  const codici = [s1.codice,'9876','8765']
  expect((await apriSessione(db,a.id,() => codici.shift()!)).codice).not.toBe(s1.codice)
})
