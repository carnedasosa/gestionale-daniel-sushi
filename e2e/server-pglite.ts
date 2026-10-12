import { createServer, type Server, type Socket } from 'node:net'
import type { PGlite } from '@electric-sql/pglite'

// PGlite ha una sola connessione. Questo server la divide fra più client Postgres (il pool dell'app)
// mandando a PGlite blocchi interi di protocollo: dal primo messaggio fino a Sync o Query.
// Così i Parse/Bind/Execute di due connessioni non si mescolano, e una transazione aperta
// tiene PGlite per la sua connessione finché non si chiude.
const SSL_REQUEST = 80877103, CANCEL_REQUEST = 80877102, PROTOCOLLO_3 = 196608
const FINE_BLOCCO = new Set(['S','Q']) // Sync, Query semplice

interface Blocco { connessione: number; dati: Uint8Array; scrivi: (risposta: Uint8Array) => void; fatto: () => void }

export function avviaServerPglite(db: PGlite, porta: number): Promise<Server> {
  const coda: Blocco[] = []
  let inCorso = false, ultima: number | null = null, prossimoId = 1
  async function elabora() {
    if (inCorso) return
    inCorso = true
    try {
      while (coda.length) {
        // Durante una transazione passano solo i blocchi della connessione che l'ha aperta.
        const i = db.isInTransaction() && ultima !== null ? coda.findIndex(b => b.connessione === ultima) : 0
        if (i === -1) { if (process.env.E2E_DEBUG) console.log(`[db] transazione di #${ultima}: in attesa, coda ${coda.map(c => c.connessione).join(',')}`); break }
        const [b] = coda.splice(i,1)
        if (process.env.E2E_DEBUG) console.log(`[db] #${b.connessione} ${Buffer.from(b.dati).toString('latin1').replace(/[^ -~]+/g,' ').slice(0,140)}`)
        try { await db.runExclusive(() => db.execProtocolRawStream(b.dati,{ onRawData: b.scrivi })) }
        finally { ultima = b.connessione; b.fatto() }
      }
    } finally { inCorso = false }
  }
  const accoda = (connessione: number, dati: Uint8Array, scrivi: (r: Uint8Array) => void) =>
    new Promise<void>(fatto => { coda.push({ connessione,dati,scrivi,fatto }); void elabora() })

  const server = createServer((socket: Socket) => {
    const id = prossimoId++
    let buffer = Buffer.alloc(0), avviata = false, catena = Promise.resolve()
    const scrivi = (r: Uint8Array) => { if (r.length && socket.writable) socket.write(r) }
    socket.setNoDelay(true)
    socket.on('data',parte => {
      buffer = Buffer.concat([buffer,parte])
      const blocchi: Buffer[] = []
      let inizio = 0, pos = 0
      while (true) {
        if (!avviata) {
          // Messaggi iniziali senza tipo: richiesta SSL (si risponde «N»), annullamento, avvio.
          if (buffer.length - pos < 8) break
          const lunghezza = buffer.readInt32BE(pos), codice = buffer.readInt32BE(pos + 4)
          if (buffer.length - pos < lunghezza) break
          if (codice === SSL_REQUEST) socket.write('N')
          else if (codice === CANCEL_REQUEST) { /* non supportato: si ignora */ }
          else if (codice === PROTOCOLLO_3) { blocchi.push(buffer.subarray(pos,pos + lunghezza)); avviata = true }
          pos += lunghezza; inizio = pos
          continue
        }
        if (buffer.length - pos < 5) break
        const tipo = String.fromCharCode(buffer[pos]), lunghezza = 1 + buffer.readInt32BE(pos + 1)
        if (buffer.length - pos < lunghezza) break
        pos += lunghezza
        // Terminate chiude solo questa connessione: a PGlite non va mandato.
        if (tipo === 'X') { if (pos - lunghezza > inizio) blocchi.push(buffer.subarray(inizio,pos - lunghezza)); inizio = pos }
        else if (FINE_BLOCCO.has(tipo)) { blocchi.push(buffer.subarray(inizio,pos)); inizio = pos }
      }
      buffer = buffer.subarray(inizio)
      for (const blocco of blocchi) catena = catena.then(() => accoda(id,new Uint8Array(blocco),scrivi))
    })
    socket.on('error',() => socket.destroy())
    socket.on('close',() => {
      catena = catena.then(async () => {
        // Una connessione chiusa a metà transazione non deve lasciare PGlite bloccato.
        if (db.isInTransaction() && ultima === id) { await db.exec('rollback'); ultima = null }
        void elabora()
      })
    })
  })
  return new Promise((risolvi,rifiuta) => { server.once('error',rifiuta); server.listen(porta,'127.0.0.1',() => risolvi(server)) })
}
