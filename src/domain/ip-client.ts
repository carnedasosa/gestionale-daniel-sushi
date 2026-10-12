import { isIP } from 'node:net'

// Chiave con cui contare i tentativi per indirizzo, o null se l'indirizzo manca o non è valido:
// in quel caso si conta solo per dispositivo e sessione, invece di mettere tutti nello stesso secchio.
export function ipDaHeaders(h: Pick<Headers,'get'>): string | null {
  return reteDaIp(h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip')?.trim() || '')
}

export function reteDaIp(ip: string): string | null {
  const indirizzo = ip.split('%')[0].toLowerCase()
  const tipo = isIP(indirizzo)
  if (tipo === 4) return indirizzo
  if (tipo !== 6) return null
  const g = gruppiIpv6(indirizzo)
  // IPv4 incapsulato in IPv6 (::ffff:a.b.c.d): si conta come l'indirizzo IPv4.
  if (g.slice(0,5).every(x => x === 0) && g[5] === 0xffff) return [g[6] >> 8,g[6] & 255,g[7] >> 8,g[7] & 255].join('.')
  // Una rete /64 è di solito una sola casa o un solo server, e chi la usa può cambiare a piacere
  // le ultime 64 cifre binarie: si conta per rete, non per singolo indirizzo.
  return `${g.slice(0,4).map(x => x.toString(16)).join(':')}::/64`
}

// Gli otto gruppi da 16 bit di un indirizzo IPv6 già validato da isIP.
function gruppiIpv6(ip: string): number[] {
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip)
  const testo = v4 ? `${ip.slice(0,v4.index)}${((+v4[1] << 8) | +v4[2]).toString(16)}:${((+v4[3] << 8) | +v4[4]).toString(16)}` : ip
  const [sinistra,destra] = testo.split('::')
  const sx = sinistra ? sinistra.split(':') : [], dx = destra ? destra.split(':') : []
  const zeri = destra === undefined ? 0 : 8 - sx.length - dx.length
  return [...sx,...Array<string>(zeri).fill('0'),...dx].map(x => parseInt(x,16))
}
