export function slugDaNome(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'') || 'tavolo'
}
export function slugLibero(nome: string, occupati: string[]): string {
  const base = slugDaNome(nome), esistenti = new Set(occupati)
  if (!esistenti.has(base)) return base
  for (let i = 2; ; i++) {
    const suffisso = `-${i}`, slug = `${base.slice(0,40-suffisso.length).replace(/-+$/,'')}${suffisso}`
    if (!esistenti.has(slug)) return slug
  }
}
