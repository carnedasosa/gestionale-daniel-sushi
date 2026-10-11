import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'

const file = '20261012180000_correzioni_tavolo.sql'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>
beforeEach(async () => {
  ambiente = await creaDbDiTest({ primaDi: file })
  await ambiente.db.query("insert into tavoli(nome,slug) values ('Prima','prima'),('Secondo','secondo')")
  await ambiente.pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
})
afterEach(async () => { await ambiente.pg.close() })
it('assegna chiavi valide e distinte ai tavoli esistenti, vieta duplicati e formati errati', async () => {
  const { db } = ambiente
  const tavoli = await db.query<{ chiave: string }>('select chiave from tavoli')
  expect(tavoli).toHaveLength(2)
  for (const t of tavoli) expect(t.chiave).toMatch(/^[a-z0-9]{12}$/)
  expect(new Set(tavoli.map(t => t.chiave)).size).toBe(2)
  await expect(db.query("insert into tavoli(nome,slug,chiave) values ('X','x',$1)",[tavoli[0].chiave])).rejects.toThrow(/unique/i)
  await expect(db.query("insert into tavoli(nome,slug,chiave) values ('X','x','corta')")).rejects.toThrow(/check/i)
})
it('chiave invio unica, null storici ammessi e tentativi eliminati con la sessione', async () => {
  const { db } = ambiente
  const [s] = await db.query<{ id: string }>("insert into sessioni_tavolo(tavolo_id,codice) select id,'1234' from tavoli where slug='prima' returning id")
  const key = '11111111-1111-4111-8111-111111111111'
  await db.query('insert into ordini(sessione_id,totale_cent,chiave_invio) values ($1,0,$2)',[s.id,key])
  await expect(db.query('insert into ordini(sessione_id,totale_cent,chiave_invio) values ($1,0,$2)',[s.id,key])).rejects.toThrow(/unique/i)
  await db.query('insert into ordini(sessione_id,totale_cent) values ($1,0),($1,0)',[s.id])
  await db.query("insert into tentativi_codice(tavolo_id,sessione_id,dispositivo,ip) select tavolo_id,id,gen_random_uuid(),'127.0.0.1' from sessioni_tavolo where id=$1",[s.id])
  await db.query('delete from ordini where sessione_id=$1',[s.id])
  await db.query('delete from sessioni_tavolo where id=$1',[s.id])
  expect(await db.query('select * from tentativi_codice')).toEqual([])
})
