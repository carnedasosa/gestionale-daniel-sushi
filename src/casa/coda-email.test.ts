import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { creaDbDiTest } from '../../tests/db/pglite'
import { ordineAsporto, preparaCasa } from '../../tests/db/casa-pronta'
import { smaltisciCodaEmail } from './coda-email'
import { prendiEmailDaInviare } from './email-repo'
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
  for (let i = 0; i < 6; i++) await smaltisciCodaEmail(ambiente.db,ENV,fetchFinto)
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
