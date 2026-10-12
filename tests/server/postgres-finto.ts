import net from 'node:net'

// Server finto che parla il protocollo v3 di Postgres quanto basta a un driver, senza database.
// - una query che contiene «cade» chiude il socket senza rispondere (connessione persa a metà);
// - una query che contiene «lenta» risponde dopo 30 ms;
// - begin/commit/rollback aggiornano lo stato della transazione;
// - ogni altra query restituisce una riga { n: '1' }.
export interface PostgresFinto {
  url: string
  /** connessioni TCP accettate */
  connessioni: () => number
  /** massimo di query in volo sulla stessa connessione (>1 = pipelining) */
  massimoPerConnessione: () => number
  /** massimo di query in volo su tutte le connessioni insieme */
  massimoTotale: () => number
  chiudi: () => Promise<void>
}

const int16 = (n: number) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b }
const int32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b }
const cstr = (s: string) => Buffer.from(s + '\0')
const msg = (tipo: string, corpo: Buffer = Buffer.alloc(0)) => Buffer.concat([Buffer.from(tipo), int32(corpo.length + 4), corpo])
// Una colonna «n» di tipo text (oid 25) e una riga con il valore '1'.
const DESCRIZIONE = msg('T', Buffer.concat([int16(1), cstr('n'), int32(0), int16(0), int32(25), int16(-1), int32(-1), int16(0)]))
const RIGA = msg('D', Buffer.concat([int16(1), int32(1), Buffer.from('1')]))
const attendi = (ms: number) => new Promise(r => setTimeout(r, ms))
interface Messaggio { tipo: string; corpo: Buffer }

export async function avviaPostgresFinto(): Promise<PostgresFinto> {
  let connessioni = 0, totale = 0, massimoTotale = 0, massimoPerConnessione = 0
  const aperti = new Set<net.Socket>()
  const server = net.createServer(s => {
    connessioni++; aperti.add(s); s.on('error', () => {})
    let buffer = Buffer.alloc(0), avviato = false, stato = 'I', inVolo = 0, catena = Promise.resolve()
    // Query del protocollo esteso in corso: da Parse fino a Sync, anche attraverso un Flush.
    let estesa: { testo: string; parametri: number } | null = null, gruppo: Messaggio[] = []
    s.on('close', () => { aperti.delete(s); totale -= inVolo; inVolo = 0 })
    const inizia = () => { inVolo++; totale++; massimoPerConnessione = Math.max(massimoPerConnessione, inVolo); massimoTotale = Math.max(massimoTotale, totale) }
    const rispondi = (testo: string, corpo: () => Buffer, fine: boolean) => {
      catena = catena.then(async () => {
        if (s.destroyed) return
        if (testo.includes('cade')) { s.destroy(); return }
        if (testo.includes('lenta')) await attendi(30)
        if (s.destroyed) return
        if (fine && /^\s*begin/i.test(testo)) stato = 'T'
        else if (fine && /^\s*(commit|rollback)/i.test(testo)) stato = 'I'
        const fuori = corpo()
        if (fine) { inVolo--; totale-- }
        s.write(fine ? Buffer.concat([fuori, msg('Z', Buffer.from(stato))]) : fuori)
      })
    }
    const risposte = (messaggi: Messaggio[], parametri: number) => Buffer.concat(messaggi.map(m =>
      m.tipo === 'P' ? msg('1')
      : m.tipo === 'B' ? msg('2')
      // Describe di uno statement ('S') vuole anche la descrizione dei parametri (qui tutti text).
      : m.tipo === 'D' ? (m.corpo[0] === 0x53 ? Buffer.concat([msg('t', Buffer.concat([int16(parametri), ...Array.from({ length: parametri }, () => int32(25))])), DESCRIZIONE]) : DESCRIZIONE)
      : m.tipo === 'E' ? Buffer.concat([RIGA, msg('C', cstr('SELECT 1'))])
      : Buffer.alloc(0)))
    s.on('data', dati => {
      buffer = Buffer.concat([buffer, dati])
      if (!avviato) {
        if (buffer.length < 4 || buffer.length < buffer.readInt32BE(0)) return
        buffer = buffer.subarray(buffer.readInt32BE(0)); avviato = true
        s.write(Buffer.concat([msg('R', int32(0)), msg('K', Buffer.concat([int32(1), int32(1)])), msg('Z', Buffer.from('I'))]))
      }
      while (buffer.length >= 5 && buffer.length >= 1 + buffer.readInt32BE(1)) {
        const tipo = String.fromCharCode(buffer[0]), fine = 1 + buffer.readInt32BE(1)
        const corpo = buffer.subarray(5, fine); buffer = buffer.subarray(fine)
        if (tipo === 'X') { s.end(); return }
        if (tipo === 'Q') {
          const testo = corpo.toString('utf8', 0, corpo.indexOf(0))
          const comando = /^\s*(\w+)/.exec(testo)?.[1]?.toUpperCase() ?? 'SELECT'
          inizia()
          rispondi(testo, () => comando === 'SELECT' ? Buffer.concat([DESCRIZIONE, RIGA, msg('C', cstr('SELECT 1'))]) : msg('C', cstr(comando)), true)
        } else if (tipo === 'H' || tipo === 'S') {
          const q = estesa ?? { testo: '', parametri: 0 }, messaggi = gruppo
          gruppo = []
          if (tipo === 'S') estesa = null
          rispondi(q.testo, () => risposte(messaggi, q.parametri), tipo === 'S')
        } else {
          if (!estesa) { estesa = { testo: '', parametri: 0 }; inizia() }
          if (tipo === 'P') {
            const fineNome = corpo.indexOf(0), fineTesto = corpo.indexOf(0, fineNome + 1)
            estesa.testo = corpo.toString('utf8', fineNome + 1, fineTesto)
            estesa.parametri = corpo.readInt16BE(fineTesto + 1)
          }
          gruppo.push({ tipo, corpo })
        }
      }
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as net.AddressInfo
  return {
    url: `postgres://prova:prova@127.0.0.1:${port}/prova`,
    connessioni: () => connessioni,
    massimoPerConnessione: () => massimoPerConnessione,
    massimoTotale: () => massimoTotale,
    chiudi: () => new Promise(r => { for (const s of aperti) s.destroy(); server.close(() => r()) }),
  }
}
