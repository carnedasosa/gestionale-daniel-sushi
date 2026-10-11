export function ipDaHeaders(h: Pick<Headers,'get'>): string {
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip')?.trim() || 'sconosciuto'
}
