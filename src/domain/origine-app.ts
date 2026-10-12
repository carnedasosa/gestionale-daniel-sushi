export function origineApp(h: Pick<Headers,'get'>, appUrl?: string): string {
  const host = h.get('host') ?? ''
  const locale = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  // Solo http o https: qualunque altro valore inoltrato viene ignorato.
  const inoltrato = h.get('x-forwarded-proto')?.split(',')[0].trim().toLowerCase()
  const proto = inoltrato === 'http' || inoltrato === 'https' ? inoltrato : locale ? 'http' : 'https'
  const url = new URL(appUrl?.trim() || `${proto}://${host}`)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('APP_URL non valido')
  return url.origin
}
