export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function idValido(id: unknown): id is string { return typeof id === 'string' && UUID.test(id) }
export function slugValido(slug: unknown): slug is string { return typeof slug === 'string' && /^[a-z0-9-]{1,40}$/.test(slug) }
export function nomeValido(nome: unknown): nome is string { return typeof nome === 'string' && nome.trim().length >= 1 && nome.trim().length <= 40 }
