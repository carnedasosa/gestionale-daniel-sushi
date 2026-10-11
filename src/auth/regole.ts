export type Ruolo = 'staff' | 'admin'

function sottoSezione(pathname: string, sezione: string): boolean {
  return pathname === sezione || pathname.startsWith(`${sezione}/`)
}

export function ruoloRichiesto(pathname: string): Ruolo | null {
  if (sottoSezione(pathname, '/admin')) return 'admin'
  if (sottoSezione(pathname, '/staff')) return 'staff'
  return null
}

export function haAccesso(richiesto: Ruolo, ruolo: Ruolo | null): boolean {
  if (ruolo === null) return false
  return ruolo === 'admin' || richiesto === 'staff'
}

export function destinazioneDopoLogin(next: string | null | undefined, ruolo: Ruolo): string {
  const home = ruolo === 'admin' ? '/admin' : '/staff'
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return home
  const richiesto = ruoloRichiesto(next.split(/[?#]/)[0])
  return richiesto && haAccesso(richiesto, ruolo) ? next : home
}
