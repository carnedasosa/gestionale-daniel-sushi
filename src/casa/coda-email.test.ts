import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'
import { smaltisciCodaEmail } from './coda-email'
import { emailInErroreDefinitivo, prendiEmailDaInviare } from './email-repo'
import { configEmail } from './resend'
let ambiente: Awaited<ReturnType<typeof creaDbDiTest>>, piatto: string
const ENV = { RESEND_API_KEY: 're_prova',EMAIL_MITTENTE: "Daniel's Sushi <ordini@esempio.it>",APP_URL: 'https://ordini.esempio.it/qualcosa' }
beforeEach(async () => { ambiente = await creaDbDiTest({ seed: true }); ({ piatto } = await preparaCasa(ambiente.db)) })
afterEach(async () => { await ambiente.pg.close() })
const coda = () => ambiente.db.query<{ tipo: string; tentativi: number; inviata: boolean; errore: string | null; inInvio: boolean }>('select tipo,tentativi,inviata_il is not null as inviata,ultimo_errore as errore,in_invio_dal is not null as "inInvio" from email_ordini order by creata_il')
it('configurazione: servono chiave, mittente e un APP_URL http(s)', () => {
  expect(configEmail(ENV)).toEqual({ apiKey: 're_prova',mittente: ENV.EMAIL_MITTENTE,origine: 'https://ordini.esempio.it' })
  for (const diverso of [{ RESEND_API_KEY: '' },{ EMAIL_MITTENTE: undefined },{ APP_URL: 'ftp://x.it' },{ APP_URL: 'non un url' }]) expect(configEmail({ ...ENV,...diverso })).toBeNull()
})
it('email spente: la coda resta intatta', async () => {
  await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn()
  expect(await smaltisciCodaEmail(ambiente.db,{},fetchFinto)).toEqual({ inviate: 0,errori: 0 })
  expect(fetchFinto).not.toHaveBeenCalled()
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 0,inviata: false,errore: null,inInvio: false }])
})
it('invio riuscito: destinatario, chiave d’idempotenza e link della pagina dello stato', async () => {
  const o = await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn(async () => new Response('{"id":"x"}',{ status: 200 }))
  expect(await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)).toEqual({ inviate: 1,errori: 0 })
  const [url,opzioni] = fetchFinto.mock.calls[0] as unknown as [string,RequestInit]
  const [{ id }] = await ambiente.db.query<{ id: string }>('select id from email_ordini')
  expect(url).toBe('https://api.resend.com/emails')
  expect(opzioni.headers).toMatchObject({ Authorization: 'Bearer re_prova','Idempotency-Key': id })
  const corpo = JSON.parse(opzioni.body as string)
  expect(corpo).toMatchObject({ from: ENV.EMAIL_MITTENTE,to: ['anna@esempio.it'],subject: `Abbiamo ricevuto il tuo ordine n. ${o.numero}` })
  expect(corpo.text).toContain(`https://ordini.esempio.it/ordine/${o.token}`)
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 1,inviata: true,errore: null,inInvio: false }])
  expect(await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)).toEqual({ inviate: 0,errori: 0 })
})
it('errore di Resend registrato e ritentato, fino a 5 tentativi', async () => {
  await ordineAsporto(ambiente.db,piatto)
  const fetchFinto = vi.fn(async () => new Response('limite superato',{ status: 429 }))
  const log = vi.spyOn(console,'error').mockImplementation(() => {})
  for (let i = 0; i < 6; i++) await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
  log.mockRestore()
  expect(fetchFinto).toHaveBeenCalledTimes(5)
  expect(await coda()).toEqual([{ tipo: 'ricevuto',tentativi: 5,inviata: false,errore: 'Resend 429: limite superato',inInvio: false }])
})
it('una presa in carico non viene ripresa per 2 minuti; gli ordini anonimizzati non partono', async () => {
  const o = await ordineAsporto(ambiente.db,piatto)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(1)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(0)
  await ambiente.db.query(`update email_ordini set in_invio_dal=now()-interval '3 minutes'`)
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(1)
  await ambiente.db.query(`update email_ordini set in_invio_dal=null`)
  await ambiente.db.query(`update ordini set cliente_nome=null,cliente_telefono=null,cliente_email=null,anonimizzato_il=now() where id=$1`,[o.id])
  expect(await prendiEmailDaInviare(ambiente.db)).toHaveLength(0)
})
it('al quinto tentativo fallito l’errore finisce nei log, senza indirizzi email; prima no', async () => {
  const o = await ordineAsporto(ambiente.db,piatto)
  const log = vi.spyOn(console,'error').mockImplementation(() => {})
  const fetchFinto = vi.fn(async () => new Response('indirizzo anna@esempio.it rifiutato',{ status: 422 }))
  try {
    for (let i = 0; i < 4; i++) await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
    expect(log).not.toHaveBeenCalled()
    await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(`Email ricevuto dell'ordine n. ${o.numero} non inviata dopo 5 tentativi: Resend 422: indirizzo [email] rifiutato`)
    await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
    expect(log).toHaveBeenCalledTimes(1)
  } finally { log.mockRestore() }
})
it('email in errore definitivo: conta solo quelle a 5 tentativi di ordini non anonimizzati, con l’errore della più recente', async () => {
  expect(await emailInErroreDefinitivo(ambiente.db)).toEqual({ n: 0,ultimoErrore: null,ultimaIl: null })
  const [o1,o2,o3] = [await ordineAsporto(ambiente.db,piatto),await ordineAsporto(ambiente.db,piatto),await ordineAsporto(ambiente.db,piatto)]
  expect(await emailInErroreDefinitivo(ambiente.db)).toEqual({ n: 0,ultimoErrore: null,ultimaIl: null })
  const segna = (ordine: string, tipo: string, tentativi: number, errore: string, creata: string) =>
    ambiente.db.query(`insert into email_ordini (ordine_id,tipo,tentativi,ultimo_errore,creata_il) values ($1,$2,$3,$4,$5)
      on conflict (ordine_id,tipo) do update set tentativi=excluded.tentativi,ultimo_errore=excluded.ultimo_errore,creata_il=excluded.creata_il`,[ordine,tipo,tentativi,errore,creata])
  await segna(o1.id,'ricevuto',5,'errore vecchio','2026-10-12T16:00:00Z')
  await segna(o2.id,'ricevuto',5,'errore nuovo','2026-10-12T17:00:00Z')
  await segna(o1.id,'accettato',4,'ancora un tentativo','2026-10-12T18:00:00Z')
  await segna(o3.id,'ricevuto',5,'ordine anonimizzato','2026-10-12T19:00:00Z')
  await ambiente.db.query(`update ordini set cliente_nome=null,cliente_telefono=null,cliente_email=null,anonimizzato_il=now() where id=$1`,[o3.id])
  expect(await emailInErroreDefinitivo(ambiente.db)).toEqual({ n: 2,ultimoErrore: 'errore nuovo',ultimaIl: new Date('2026-10-12T17:00:00Z') })
  await ambiente.db.query(`update email_ordini set inviata_il=now() where ordine_id=$1 and tipo='ricevuto'`,[o2.id])
  expect(await emailInErroreDefinitivo(ambiente.db)).toEqual({ n: 1,ultimoErrore: 'errore vecchio',ultimaIl: new Date('2026-10-12T16:00:00Z') })
})
