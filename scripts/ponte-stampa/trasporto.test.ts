import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:net'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { LAVORI_FISCALI_PER_GIRO, LAVORI_PER_GIRO, SCADENZA_LAVORO_SECONDI } from '@/stampa/instradamento'
import { eseguiLavoro, giro, inviaFpmate, inviaTcp, leggiConfigurazione, TIMEOUT_FPMATE_MS, TIMEOUT_TCP_MS, type Configurazione, type LavoroRicevuto } from './trasporto'

let server: Server | null = null, cartella: string | null = null, muta: Server | null = null
afterEach(() => { server?.close(); server = null; muta?.close(); muta = null; if (cartella) rmSync(cartella,{ recursive: true,force: true }); cartella = null })
/** Una «stampante» finta sulla porta 9100 di questo PC: raccoglie i byte ricevuti. */
function stampanteFinta(): Promise<{ porta: number; ricevuto: () => Buffer }> {
  const pezzi: Buffer[] = []
  return new Promise(ok => {
    server = createServer(s => { s.on('data',d => pezzi.push(d)); s.on('end',() => s.end()) })
    server.listen(0,'127.0.0.1',() => ok({ porta: (server!.address() as { port: number }).port,ricevuto: () => Buffer.concat(pezzi) }))
  })
}
/** Stampante che prende i byte e non chiude mai la connessione. */
function stampanteMuta(): Promise<{ porta: number; ricevuto: () => Buffer }> {
  const pezzi: Buffer[] = []
  return new Promise(ok => {
    muta = createServer({ allowHalfOpen: true },s => { s.on('data',d => pezzi.push(d)); s.on('error',() => {}) })
    muta.listen(0,'127.0.0.1',() => ok({ porta: (muta!.address() as { port: number }).port,ricevuto: () => Buffer.concat(pezzi) }))
  })
}
const lavoro = (extra: Partial<LavoroRicevuto> = {}): LavoroRicevuto => ({ id: 'l1',stampante: 'banco',tipo: 'comanda',formato: 'escpos',dati: Buffer.from('COMANDA\n').toString('base64'),anteprima: 'COMANDA',...extra })
const config = (extra: Partial<Configurazione> = {}): Configurazione => ({ server: 'https://gestionale.example',token: 't'.repeat(40),stampanti: {},...extra })

describe('stampanti termiche', () => {
  it('manda i byte alla porta 9100', async () => {
    const s = await stampanteFinta()
    await inviaTcp('127.0.0.1',s.porta,Buffer.from([0x1b,0x40,0x41]))
    await new Promise(r => setTimeout(r,20))
    expect([...s.ricevuto()]).toEqual([0x1b,0x40,0x41])
  })
  it('stampante spenta: errore, che diventa un esito non riuscito', async () => {
    const s = await stampanteFinta(); server!.close(); server = null
    await expect(inviaTcp('127.0.0.1',s.porta,Buffer.from('x'))).rejects.toThrow()
    expect(await eseguiLavoro(lavoro(),config({ stampanti: { banco: { host: '127.0.0.1',porta: s.porta } } }))).toMatchObject({ id: 'l1',ok: false })
  })
  it('stampante che prende i byte e non chiude: riuscito appena sono partiti, senza aspettare che scada il tempo', async () => {
    const s = await stampanteMuta(), partenza = Date.now()
    await inviaTcp('127.0.0.1',s.porta,Buffer.from('x'),5000)
    expect(Date.now() - partenza).toBeLessThan(2500)
    await new Promise(r => setTimeout(r,20))
    expect(s.ricevuto().toString()).toBe('x')
    expect(await eseguiLavoro(lavoro(),config({ stampanti: { banco: { host: '127.0.0.1',porta: s.porta } } }),fetch,50)).toEqual({ id: 'l1',ok: true })
  })
  it('lavoro per una stampante non configurata nel ponte', async () => {
    expect(await eseguiLavoro(lavoro({ stampante: 'cucina' }),config())).toEqual({ id: 'l1',ok: false,errore: 'stampante «cucina» non configurata nel ponte' })
  })
})

describe('registratore telematico', () => {
  const finto = (fn: () => Promise<Response>) => (async () => fn()) as unknown as typeof fetch
  it('risposta HTTP: riuscito, il server leggerà l’XML; HTTP in errore: incerto', async () => {
    expect(await inviaFpmate('http://rt',`<x/>`,finto(async () => new Response('<response success="true"/>')))).toEqual({ ok: true,risposta: '<response success="true"/>' })
    expect(await inviaFpmate('http://rt',`<x/>`,finto(async () => new Response('boh',{ status: 500 })))).toMatchObject({ ok: false,incerto: true })
  })
  it('connessione rifiutata: certamente non stampato; tempo scaduto: incerto', async () => {
    const rifiutata = Object.assign(new TypeError('fetch failed'),{ cause: { code: 'ECONNREFUSED' } })
    expect(await inviaFpmate('http://rt','<x/>',finto(async () => { throw rifiutata }))).toMatchObject({ ok: false,incerto: false })
    expect(await inviaFpmate('http://rt','<x/>',finto(async () => { throw new DOMException('scaduto','TimeoutError') }))).toMatchObject({ ok: false,incerto: true })
  })
  it('senza registratore configurato il lavoro fiscale non parte', async () => {
    expect(await eseguiLavoro(lavoro({ stampante: 'fiscale',formato: 'fpmate',dati: '<x/>' }),config())).toMatchObject({ ok: false,incerto: false })
  })
})

describe('modalità prova e giro completo', () => {
  it('in prova scrive anteprima e byte in una cartella invece di stampare', async () => {
    cartella = mkdtempSync(path.join(tmpdir(),'ponte-'))
    expect(await eseguiLavoro(lavoro(),config({ prova: cartella }))).toEqual({ id: 'l1',ok: true })
    expect(await eseguiLavoro(lavoro({ id: 'l2',stampante: 'fiscale',formato: 'fpmate',dati: '<scontrino/>' }),config({ prova: cartella }))).toEqual({ id: 'l2',ok: true,risposta: 'PROVA' })
    const file = readdirSync(cartella).sort()
    expect(file.filter(f => f.endsWith('.txt'))).toHaveLength(2)
    expect(readFileSync(path.join(cartella,file.find(f => f.endsWith('.bin'))!),'utf8')).toBe('COMANDA\n')
    expect(readFileSync(path.join(cartella,file.find(f => f.endsWith('.xml'))!),'utf8')).toBe('<scontrino/>')
  })
  it('giro: chiede la coda col token, esegue e riporta ogni esito', async () => {
    const s = await stampanteFinta()
    const chiamate: { url: string; init?: RequestInit }[] = []
    const recupera = (async (url: URL | string, init?: RequestInit) => {
      chiamate.push({ url: String(url),init })
      return String(url).endsWith('/coda') ? Response.json({ lavori: [lavoro()] }) : Response.json({ registrato: true })
    }) as typeof fetch
    expect(await giro(config({ stampanti: { banco: { host: '127.0.0.1',porta: s.porta } } }),recupera)).toBe(1)
    expect(chiamate.map(c => c.url)).toEqual(['https://gestionale.example/api/stampa/coda','https://gestionale.example/api/stampa/esito'])
    expect((chiamate[0].init!.headers as Record<string,string>).Authorization).toBe(`Bearer ${'t'.repeat(40)}`)
    expect(JSON.parse(String(chiamate[1].init!.body))).toEqual({ id: 'l1',ok: true })
  })
  it('un giro con le stampanti ferme finisce molto prima che i suoi lavori scadano', () => {
    const scadenza = SCADENZA_LAVORO_SECONDI * 1000
    expect(LAVORI_PER_GIRO * TIMEOUT_TCP_MS).toBeLessThanOrEqual(scadenza / 2)
    expect(LAVORI_FISCALI_PER_GIRO * TIMEOUT_FPMATE_MS).toBeLessThanOrEqual(scadenza / 2)
  })
  /** Il gestionale finto: dà i lavori e tiene l'ordine e il momento degli esiti. */
  const gestionale = (lavori: LavoroRicevuto[], rispondi: (id: string) => Response | Promise<Response> = () => Response.json({ registrato: true })) => {
    const esiti: { id: string; ok: boolean; dopoMs: number }[] = [], partenza = Date.now()
    const recupera = (async (url: URL | string, init?: RequestInit) => {
      if (String(url).endsWith('/coda')) return Response.json({ lavori })
      const e = JSON.parse(String(init!.body)) as { id: string; ok: boolean }
      esiti.push({ ...e,dopoMs: Date.now() - partenza })
      return rispondi(e.id)
    }) as typeof fetch
    return { esiti,recupera }
  }
  it('banco spento e cucina accesa: la cucina esce, il banco riporta l’errore, ogni esito arriva', async () => {
    const spenta = await stampanteFinta(); server!.close()
    const cucina = await stampanteFinta()
    const { esiti,recupera } = gestionale([lavoro({ id: 'b1' }),lavoro({ id: 'b2' }),lavoro({ id: 'c1',stampante: 'cucina' })])
    const c = config({ stampanti: { banco: { host: '127.0.0.1',porta: spenta.porta },cucina: { host: '127.0.0.1',porta: cucina.porta } } })
    expect(await giro(c,recupera)).toBe(3)
    expect(esiti.map(e => [e.id,e.ok]).sort()).toEqual([['b1',false],['b2',false],['c1',true]])
  })
  it('in fila sulla stessa stampante, in parallelo fra stampanti diverse', async () => {
    const s = await stampanteFinta(), attesa = 150
    const lavori = [lavoro({ id: 'b1' }),lavoro({ id: 'b2' }),lavoro({ id: 'b3' }),lavoro({ id: 'c1',stampante: 'cucina' })]
    const { esiti,recupera } = gestionale(lavori,async () => { await new Promise(r => setTimeout(r,attesa)); return Response.json({ registrato: true }) })
    const c = config({ stampanti: { banco: { host: '127.0.0.1',porta: s.porta },cucina: { host: '127.0.0.1',porta: s.porta } } })
    expect(await giro(c,recupera)).toBe(4)
    expect(esiti.map(e => e.id).filter(id => id.startsWith('b'))).toEqual(['b1','b2','b3'])
    const quando = (id: string) => esiti.find(e => e.id === id)!.dopoMs
    // Il terzo aspetta che il gestionale abbia preso i primi due; la cucina no.
    expect(quando('b3')).toBeGreaterThanOrEqual(2 * attesa - 20)
    expect(quando('c1')).toBeLessThan(quando('b3'))
  })
  it('il gestionale non prende un esito: quella coda si ferma, le altre finiscono, il giro segnala l’errore', async () => {
    const banco = await stampanteFinta(), cucina = await stampanteMuta()
    const lavori = [lavoro({ id: 'b1' }),lavoro({ id: 'b2' }),lavoro({ id: 'c1',stampante: 'cucina' }),lavoro({ id: 'c2',stampante: 'cucina' })]
    const { esiti,recupera } = gestionale(lavori,id => id === 'b1' ? new Response('',{ status: 500 }) : Response.json({ registrato: true }))
    const c = config({ stampanti: { banco: { host: '127.0.0.1',porta: banco.porta },cucina: { host: '127.0.0.1',porta: cucina.porta } } })
    await expect(giro(c,recupera,50)).rejects.toThrow('HTTP 500')
    expect(esiti.map(e => e.id).sort()).toEqual(['b1','c1','c2'])
  })
  it('gestionale che risponde male: il giro si ferma con un errore (si riprova al giro dopo)', async () => {
    await expect(giro(config(),(async () => new Response('',{ status: 401 })) as unknown as typeof fetch)).rejects.toThrow('HTTP 401')
  })
  it('configurazione: server, token di almeno 32 caratteri (anche dall’ambiente), stampanti', () => {
    const testo = JSON.stringify({ server: 'https://g.example',stampanti: {} })
    expect(leggiConfigurazione(testo,{ STAMPA_TOKEN: 'x'.repeat(32) }).token).toBe('x'.repeat(32))
    expect(() => leggiConfigurazione(testo,{})).toThrow('token')
    expect(() => leggiConfigurazione(JSON.stringify({ server: 'ftp://g',token: 'x'.repeat(32),stampanti: {} }),{})).toThrow('server')
  })
})
