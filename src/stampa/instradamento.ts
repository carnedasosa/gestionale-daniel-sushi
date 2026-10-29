import type { Reparto } from '@/domain/reparti'
// Dove va ogni lavoro di stampa. Banco e cucina hanno la loro stampante; le bevande (sala), il pre-conto e
// tutto ciò che è della cassa escono alla cassa; lo scontrino solo dal registratore telematico.
export const STAMPANTI = ['cassa','banco','cucina','fiscale'] as const
export type Stampante = typeof STAMPANTI[number]
export const ETICHETTA_STAMPANTE: Record<Stampante,string> = { cassa: 'Cassa',banco: 'Banco sushi',cucina: 'Cucina',fiscale: 'Registratore telematico' }
export const TIPI_LAVORO = ['comanda','annullo','preconto','scontrino','prova'] as const
export type TipoLavoro = typeof TIPI_LAVORO[number]

/** Quali reparti hanno le comande su carta (impostazione della cassa). */
export interface StampaReparti { banco: boolean; cucina: boolean; sala: boolean }

/** Stampante della comanda di un reparto, o null se quel reparto lavora dallo schermo. */
export function stampanteDelReparto(reparto: Reparto, s: StampaReparti): Exclude<Stampante,'fiscale'> | null {
  if (!s[reparto]) return null
  return reparto === 'sala' ? 'cassa' : reparto
}

/** Stampante di un lavoro che non è una comanda. */
export function stampanteDelLavoro(tipo: Exclude<TipoLavoro,'comanda' | 'annullo'>): Stampante {
  return tipo === 'scontrino' ? 'fiscale' : 'cassa'
}

/**
 * Un lavoro rimasto «in stampa» oltre il limite: quelli normali tornano in coda (al più una ristampa doppia),
 * quelli fiscali no, perché un secondo invio potrebbe battere un secondo scontrino: restano da controllare.
 */
export function esitoScadenza(stampante: Stampante): 'in_coda' | 'incerta' {
  return stampante === 'fiscale' ? 'incerta' : 'in_coda'
}
export const SCADENZA_LAVORO_SECONDI = 60
export const TENTATIVI_MASSIMI = 5
/** Allarme alla cassa: ponte zitto o lavoro fermo in coda da più di così. */
export const ALLARME_SECONDI = 30

export interface StatoCoda { ponteVistoIl: Date | null; inCoda: number; piuVecchia: Date | null; errori: number; incerte: number }
export type Allarme = { tipo: 'ponte' | 'coda' | 'errori' | 'incerte'; testo: string } | null
/** Che cosa dire alla cassa sulle stampanti; null se va tutto bene o la stampa non è usata. */
export function allarmeStampa(s: StatoCoda, usata: boolean, adesso: Date): Allarme {
  if (!usata && !s.inCoda && !s.errori && !s.incerte) return null
  const secondi = (d: Date) => (adesso.getTime() - d.getTime()) / 1000
  if (s.incerte) return { tipo: 'incerte',testo: `${s.incerte === 1 ? 'Uno scontrino' : `${s.incerte} scontrini`} da controllare sul registratore.` }
  if (!s.ponteVistoIl || secondi(s.ponteVistoIl) > ALLARME_SECONDI) return { tipo: 'ponte',testo: 'Stampanti scollegate: il ponte di stampa non risponde. Le comande restano in coda.' }
  if (s.piuVecchia && secondi(s.piuVecchia) > ALLARME_SECONDI) return { tipo: 'coda',testo: `${s.inCoda === 1 ? 'Una stampa ferma' : `${s.inCoda} stampe ferme`} in coda: controlla carta e stampanti.` }
  if (s.errori) return { tipo: 'errori',testo: `${s.errori === 1 ? 'Una stampa non riuscita' : `${s.errori} stampe non riuscite`}: controlla le stampanti e ristampa.` }
  return null
}
