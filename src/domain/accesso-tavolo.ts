export function valutaAccesso(tavoloId: string, cookiePresente: boolean, s: { tavoloId: string; chiusaIl: Date | null } | null) {
  const proprio = s?.tavoloId === tavoloId
  const autorizzata = !!s && proprio && s.chiusaIl === null
  return { autorizzata,pulisci: cookiePresente && !autorizzata,chiuso: !!s && proprio && s.chiusaIl !== null }
}
