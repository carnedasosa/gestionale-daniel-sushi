import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:net'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eseguiLavoro, giro, inviaFpmate, inviaTcp, leggiConfigurazione, type Configurazione, type LavoroRicevuto } from './trasporto'

let server: Server | null = null, cartella: string | null = null
afterEach(() => { server?.close(); server = null; if (cartella) rmSync(cartella,{ recursive: true,force: true }); cartella = null })
/** Una «stampante» finta sulla porta 9100 di questo PC: raccoglie i byte ricevuti. */
function stampanteFinta(): Promise<{ porta: number; ricevuto: () => Buffer }> {
  const pezzi: Buffer[] = []
  return new Promise(ok => {
    server = createServer(s => { s.on('data',d => pezzi.push(d)); s.on('end',() => s.end()) })
    server.listen(0,'127.0.0.1',() => ok({ porta: (server!.address() as { port: number }).port,ricevuto: () => Buffer.concat(pezzi) }))
  })
}
const lavoro = (extra: Partial<LavoroRicevuto> = {}): LavoroRicevuto => ({ id: 'l1',stampante: 'banco',tipo: 'comanda',formato: 'escpos',dati: Buffer.from('COMANDA\n').toString('base64'),anteprima: 'COMANDA',...extra })
const config = (extra: Partial<Configurazione> = {}): Configurazione => ({ server: 'https://gestionale.example',token: 't'.repeat(40),stampanti: {},...extra })

describe('stampanti termiche', () => {
  it('manda i byte alla porta 9100 e aspetta la chiusura', async () => {
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
