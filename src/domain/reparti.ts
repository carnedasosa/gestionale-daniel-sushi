// Reparti del locale: chi prepara una riga. La sala prepara le bevande e porta comunque al tavolo tutti i piatti.
export const REPARTI = ['banco','cucina','sala'] as const
export type Reparto = typeof REPARTI[number]

export const ETICHETTA_REPARTO: Record<Reparto,string> = { banco: 'Banco sushi',cucina: 'Cucina',sala: 'Sala' }

/** Categoria del menù da cui la poke composta (senza piatto) prende il reparto. */
export const CATEGORIA_POKE = 'poke-bowl'

/** Reparti delle categorie del seed che non sono del banco (decisione con Daniel del 16/10). */
export const REPARTO_SEED: Record<string,Reparto> = { starter: 'cucina',primi: 'cucina',dessert: 'cucina',beverage: 'sala' }

export function repartoValido(v: unknown): v is Reparto {
  return typeof v === 'string' && (REPARTI as readonly string[]).includes(v)
}

export function repartoSeed(categoriaId: string): Reparto {
  return REPARTO_SEED[categoriaId] ?? 'banco'
}

/** Righe divise per reparto, nell'ordine di `REPARTI`, senza gruppi vuoti. L'ordine interno delle righe resta quello di partenza. */
export function raggruppaPerReparto<T extends { reparto: Reparto }>(righe: T[]): { reparto: Reparto; righe: T[] }[] {
  return REPARTI.map(reparto => ({ reparto,righe: righe.filter(r => r.reparto === reparto) })).filter(g => g.righe.length > 0)
}
