// Ponte di stampa: solo trasporto. Chiede i lavori al gestionale, li manda alle stampanti della rete del locale
// e riporta l'esito. Formato e instradamento li decide il server (src/stampa), qui non c'è logica di biglietti.
// Solo moduli di Node: gira su qualsiasi PC o Raspberry con Node 22.
import { createConnection } from 'node:net'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type NomeStampante = 'cassa' | 'banco' | 'cucina' | 'fiscale'
export interface Configurazione {
  server: string
  token: string
  intervalloSecondi?: number
  stampanti: Partial<Record<Exclude<NomeStampante,'fiscale'>,{ host: string; porta?: number }>> & { fiscale?: { url: string } }
  /** Modalità prova: scrive ogni lavoro in questa cartella invece di stamparlo. */
  prova?: string
}
export interface LavoroRicevuto { id: string; stampante: NomeStampante; tipo: string; formato: 'escpos' | 'fpmate'; dati: string; anteprima: string }
export type EsitoSenzaId = { ok: true; risposta?: string } | { ok: false; errore: string; incerto?: boolean; risposta?: string }
export type Esito = EsitoSenzaId & { id: string }

// Tempo massimo di un lavoro. Sul server un lavoro scade dopo SCADENZA_LAVORO_SECONDI: un giro intero con la stampante
// ferma deve finire molto prima, altrimenti gli ultimi lavori ripartono da capo (lo controlla trasporto.test.ts).
export const TIMEOUT_TCP_MS = 3_000
export const TIMEOUT_FPMATE_MS = 30_000

/** Byte ESC/POS alla porta 9100: riuscito quando la stampante chiude la connessione senza errori. */
export function inviaTcp(host: string, porta: number, byte: Uint8Array, timeoutMs = TIMEOUT_TCP_MS): Promise<void> {
  return new Promise((ok,ko) => {
    const s = createConnection({ host,port: porta })
    const timer = setTimeout(() => { s.destroy(); ko(new Error(`stampante ${host}:${porta} non risponde`)) },timeoutMs)
    s.on('error',err => { clearTimeout(timer); ko(err) })
    s.on('connect',() => { s.end(Buffer.from(byte)) })
    s.on('close',errore => { clearTimeout(timer); if (!errore) ok() })
  })
}

// Errori di rete che dicono con certezza che la richiesta non è arrivata al registratore.
const MAI_ARRIVATO = new Set(['ECONNREFUSED','ENOTFOUND','EHOSTUNREACH','ENETUNREACH','EAI_AGAIN'])
/**
 * Scontrino al registratore telematico Epson (fpmate.cgi). Con una risposta HTTP l'esito lo legge il server dall'XML;
 * senza risposta l'esito è «incerto» (lo scontrino potrebbe essere uscito) salvo che la connessione non sia mai partita.
 */
export async function inviaFpmate(url: string, xml: string, recupera: typeof fetch = fetch, timeoutMs = TIMEOUT_FPMATE_MS): Promise<EsitoSenzaId> {
  try {
    const r = await recupera(url,{ method: 'POST',body: xml,signal: AbortSignal.timeout(timeoutMs),headers: { 'Content-Type': 'text/xml; charset=utf-8','SOAPAction': '""','If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT' } })
    const risposta = (await r.text()).slice(0,20000)
    return r.ok ? { ok: true,risposta } : { ok: false,errore: `registratore: HTTP ${r.status}`,incerto: true,risposta }
  } catch (err) {
    const codice = (err as { cause?: { code?: string } })?.cause?.code
    return { ok: false,errore: `registratore non raggiungibile${codice ? ` (${codice})` : ''}`,incerto: !codice || !MAI_ARRIVATO.has(codice) }
  }
}

/** Un lavoro: alla stampante giusta, o nella cartella di prova. Non lancia mai: ogni problema diventa un esito. */
export async function eseguiLavoro(l: LavoroRicevuto, c: Configurazione, recupera: typeof fetch = fetch, timeoutTcpMs = TIMEOUT_TCP_MS): Promise<Esito> {
  try {
    if (c.prova) {
      mkdirSync(c.prova,{ recursive: true })
      const nome = path.join(c.prova,`${new Date().toISOString().replace(/[:.]/g,'-')}-${l.stampante}-${l.tipo}-${l.id.slice(0,8)}`)
      writeFileSync(`${nome}.txt`,l.anteprima)
      writeFileSync(l.formato === 'escpos' ? `${nome}.bin` : `${nome}.xml`,l.formato === 'escpos' ? Buffer.from(l.dati,'base64') : l.dati)
      // In prova lo scontrino «esce» con una risposta finta riconoscibile: il server la segna come prova.
      return l.formato === 'fpmate' ? { id: l.id,ok: true,risposta: 'PROVA' } : { id: l.id,ok: true }
    }
    if (l.stampante === 'fiscale') {
      if (!c.stampanti.fiscale) return { id: l.id,ok: false,errore: 'registratore non configurato nel ponte',incerto: false }
      return { id: l.id,...await inviaFpmate(c.stampanti.fiscale.url,l.dati,recupera) }
    }
    const s = c.stampanti[l.stampante]
    if (!s) return { id: l.id,ok: false,errore: `stampante «${l.stampante}» non configurata nel ponte` }
    await inviaTcp(s.host,s.porta ?? 9100,Buffer.from(l.dati,'base64'),timeoutTcpMs)
    return { id: l.id,ok: true }
  } catch (err) {
    return { id: l.id,ok: false,errore: err instanceof Error ? err.message : 'errore sconosciuto' }
  }
}

/**
 * Un giro: chiede i lavori e riporta ogni esito appena c'è. Una coda per stampante: in ordine sulla stessa stampante,
 * in parallelo fra stampanti diverse, così il banco spento non fa aspettare la cucina. Se il gestionale non prende un esito
 * quella coda si ferma, le altre finiscono, e l'errore esce a giro finito. Restituisce quanti lavori ha preso.
 */
export async function giro(c: Configurazione, recupera: typeof fetch = fetch, timeoutTcpMs = TIMEOUT_TCP_MS): Promise<number> {
  const intestazioni = { Authorization: `Bearer ${c.token}` }
  const r = await recupera(new URL('/api/stampa/coda',c.server),{ headers: intestazioni,signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`gestionale: HTTP ${r.status} su /api/stampa/coda`)
  const { lavori } = await r.json() as { lavori: LavoroRicevuto[] }
  const code = new Map<NomeStampante,LavoroRicevuto[]>()
  for (const l of lavori) code.set(l.stampante,[...code.get(l.stampante) ?? [],l])
  const finite = await Promise.allSettled([...code.values()].map(async coda => {
    for (const l of coda) {
      const esito = await eseguiLavoro(l,c,recupera,timeoutTcpMs)
      const e = await recupera(new URL('/api/stampa/esito',c.server),{ method: 'POST',headers: { ...intestazioni,'Content-Type': 'application/json' },body: JSON.stringify(esito),signal: AbortSignal.timeout(15_000) })
      if (!e.ok) throw new Error(`gestionale: HTTP ${e.status} su /api/stampa/esito`)
    }
  }))
  for (const f of finite) if (f.status === 'rejected') throw f.reason
  return lavori.length
}

export function leggiConfigurazione(testo: string, ambiente: Record<string,string | undefined>): Configurazione {
  const c = JSON.parse(testo) as Configurazione
  c.token = ambiente.STAMPA_TOKEN ?? c.token
  if (!c.server || !/^https?:\/\//.test(c.server)) throw new Error('«server» deve essere l’indirizzo del gestionale (https://…)')
  if (!c.token || c.token.length < 32) throw new Error('Manca il token: STAMPA_TOKEN nell’ambiente o «token» nel file (almeno 32 caratteri)')
  if (!c.stampanti || typeof c.stampanti !== 'object') throw new Error('Manca l’elenco «stampanti»')
  return c
}
