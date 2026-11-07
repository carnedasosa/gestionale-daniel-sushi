import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import type { Db } from '@/server/db-tipi'
import { chiaveEmail } from '@/domain/limiti-accesso'
import { annullaTentativoAccesso, eliminaTentativiAccessoVecchi, prenotaTentativoAccesso } from './tentativi-accesso-repo'

const A = 'a'.repeat(64), B = 'b'.repeat(64)
let db: Db, chiudi: () => Promise<void>
beforeEach(async () => { const ambiente = await creaDbDiTest(); db = ambiente.db; chiudi = () => ambiente.pg.close() })
afterEach(() => chiudi())

const prenota = (chiave: string, rete: string | null) => prenotaTentativoAccesso(db,{ chiave,rete,minuti: 15 })
const righe = async () => (await db.query<{ n: number }>('select count(*)::int as n from tentativi_accesso'))[0].n

it('tabella con RLS attiva e nessun privilegio alle API', async () => {
  const [r] = await db.query<{ rls: boolean; lettura: boolean; scrittura: boolean }>(`select relrowsecurity as rls,has_table_privilege('authenticated',oid,'select') as lettura,has_table_privilege('anon',oid,'insert') as scrittura from pg_class where relname='tentativi_accesso'`)
  expect(r).toEqual({ rls: true,lettura: false,scrittura: false })
})

it('conta gli errori precedenti per email e per rete, senza contare il tentativo appena registrato', async () => {
  expect((await prenota(A,'192.0.2.1')).errori).toEqual({ email: 0,rete: 0 })
  expect((await prenota(A,'192.0.2.1')).errori).toEqual({ email: 1,rete: 1 })
  expect((await prenota(A,'192.0.2.2')).errori).toEqual({ email: 2,rete: 0 })
  expect((await prenota(B,'192.0.2.1')).errori).toEqual({ email: 0,rete: 2 })
})

it('rete sconosciuta: si conta solo per email, senza mettere tutti nello stesso secchio', async () => {
  await prenota(A,null); await prenota(B,null)
  expect((await prenota(A,null)).errori).toEqual({ email: 1,rete: 0 })
})

it('un tentativo annullato non conta più', async () => {
  const { id } = await prenota(A,'192.0.2.1')
  await annullaTentativoAccesso(db,id)
  expect((await prenota(A,'192.0.2.1')).errori).toEqual({ email: 0,rete: 0 })
})

it('fuori dalla finestra di 15 minuti gli errori non contano', async () => {
  const vecchio = (await prenota(A,'192.0.2.1')).id, recente = (await prenota(A,'192.0.2.1')).id
  await db.query(`update tentativi_accesso set creato_il=now()-interval '16 minutes' where id=$1`,[vecchio])
  await db.query(`update tentativi_accesso set creato_il=now()-interval '14 minutes' where id=$1`,[recente])
  expect((await prenota(A,'192.0.2.1')).errori).toEqual({ email: 1,rete: 1 })
})

it('tentativi prenotati in contemporanea si vedono: non passano tutti', async () => {
  const esiti = await Promise.all(Array.from({ length: 5 },() => prenota(A,'192.0.2.1')))
  expect(Math.max(...esiti.map(e => e.errori.email))).toBe(4)
})

it('l’istruzione del README per sbloccare un’email a mano toglie proprio i suoi tentativi', async () => {
  await prenota(chiaveEmail('Staff@Esempio.it'),'192.0.2.1'); await prenota(A,'192.0.2.1')
  await db.query(`delete from tentativi_accesso where email_hash = encode(sha256(lower('Staff@Esempio.it')::bytea),'hex')`)
  expect(await righe()).toBe(1)
})

it('la pulizia toglie solo le righe più vecchie di 30 giorni', async () => {
  const adesso = new Date('2026-11-06T03:00:00Z')
  const vecchia = (await prenota(A,'192.0.2.1')).id, limite = (await prenota(A,'192.0.2.1')).id
  await db.query(`update tentativi_accesso set creato_il=$1::timestamptz - interval '30 days 1 second' where id=$2`,[adesso,vecchia])
  await db.query(`update tentativi_accesso set creato_il=$1::timestamptz - interval '30 days' where id=$2`,[adesso,limite])
  expect(await eliminaTentativiAccessoVecchi(db,adesso)).toBe(1)
  expect(await righe()).toBe(1)
  expect(await eliminaTentativiAccessoVecchi(db,adesso)).toBe(0)
  await expect(eliminaTentativiAccessoVecchi(db,new Date('x'))).rejects.toThrow('non validi')
})
