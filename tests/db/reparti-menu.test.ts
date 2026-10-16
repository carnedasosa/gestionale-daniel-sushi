import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { creaDbDiTest } from './pglite'

// Senza seed: quello rigenerato ha già la colonna reparto e non si applica allo schema di prima.
const file = '20261017120000_reparti_menu.sql'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, ordineId: string
const CATEGORIE = [['tartare',1],['starter',2],['primi',3],['dessert',4],['beverage',5],['poke-bowl',6]] as const
async function piatto(categoria: string, nome: string) {
  const [p] = await ambiente.db.query<{ id: string }>(`insert into piatti (categoria_id,nome,prezzo_cent,posizione) values ($1,$2,500,1) returning id`,[categoria,nome])
  return p.id
}
async function riga(piattoId: string | null, nome: string, posizione: number) {
  await ambiente.db.query(`insert into righe_ordine (ordine_id,piatto_id,nome,prezzo_unit_cent,quantita,posizione) values ($1,$2,$3,500,1,$4)`,[ordineId,piattoId,nome,posizione])
}
beforeEach(async () => {
  ambiente = await creaDbDiTest({ primaDi: file })
  for (const [id,posizione] of CATEGORIE) await ambiente.db.query('insert into categorie (id,nome,posizione) values ($1,$1,$2)',[id,posizione])
  const [t] = await ambiente.db.query<{ id: string }>(`insert into tavoli (nome,slug,chiave) values ('Uno','uno','abcdefghijkl') returning id`)
  const [s] = await ambiente.db.query<{ id: string }>(`insert into sessioni_tavolo (tavolo_id,codice) values ($1,'1234') returning id`,[t.id])
  ;[{ id: ordineId }] = await ambiente.db.query<{ id: string }>('insert into ordini (sessione_id,totale_cent) values ($1,2500) returning id',[s.id])
  await riga(await piatto('tartare','Salmone'),'Salmone',0)
  await riga(await piatto('starter','Edamame'),'Edamame',1)
  await riga(await piatto('dessert','Tiramisù'),'Tiramisù',2)
  await riga(await piatto('beverage','Coca Cola'),'Coca Cola',3)
  await riga(null,'Poke composta',4)
  await ambiente.pg.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
})
afterEach(async () => { await ambiente.pg.close() })
const reparti = async () => Object.fromEntries((await ambiente.db.query<{ nome: string; reparto: string }>('select nome,reparto from righe_ordine order by posizione')).map(r => [r.nome,r.reparto]))

it('categorie: cucina per starter, primi, dessert; sala per le bevande; il resto al banco', async () => {
  expect(await ambiente.db.query('select id,reparto from categorie order by posizione')).toEqual([
    { id: 'tartare',reparto: 'banco' },{ id: 'starter',reparto: 'cucina' },{ id: 'primi',reparto: 'cucina' },
    { id: 'dessert',reparto: 'cucina' },{ id: 'beverage',reparto: 'sala' },{ id: 'poke-bowl',reparto: 'banco' },
  ])
  await ambiente.db.query(`insert into categorie (id,nome,posizione) values ('box','Box',7)`)
  expect(await ambiente.db.query(`select reparto from categorie where id='box'`)).toEqual([{ reparto: 'banco' }])
})
it('righe esistenti: reparto della categoria del piatto, la poke composta al banco', async () => {
  expect(await reparti()).toEqual({ Salmone: 'banco',Edamame: 'cucina','Tiramisù': 'cucina','Coca Cola': 'sala','Poke composta': 'banco' })
})
it('reparto fuori elenco rifiutato; una riga nuova deve dire il suo reparto', async () => {
  await expect(ambiente.db.query(`update categorie set reparto='bar' where id='tartare'`)).rejects.toThrow(/check/)
  await expect(ambiente.db.query(`update righe_ordine set reparto='bar' where nome='Salmone'`)).rejects.toThrow(/righe_ordine_reparto_check/)
  await expect(riga(null,'Senza reparto',5)).rejects.toThrow(/null/)
})
