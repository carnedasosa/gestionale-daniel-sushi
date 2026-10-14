import { istanteRoma } from './ora-roma'
export type Servizio = 'asporto' | 'domicilio'
export const SERVIZI: readonly Servizio[] = ['asporto','domicilio']
export function servizioValido(s: unknown): s is Servizio { return s === 'asporto' || s === 'domicilio' }
export const DURATA_FASCIA = 15
export interface Turno { dalle: string; alle: string }
export interface RegoleFasce { capacitaFascia: number; capacitaConsegne: number; anticipoMinuti: number }
/** Ordini attivi (non rifiutati né annullati) già presenti in una fascia. */
export interface Occupazione { fascia: string; totale: number; domicilio: number }

/** Minuti dalla mezzanotte di un orario `HH:MM` (accetta anche `HH:MM:SS`), o null se non valido. */
export function minutiDa(orario: unknown): number | null {
  const m = typeof orario === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(orario) : null
  return m ? +m[1] * 60 + +m[2] : null
}
/** Inizi delle fasce di un giorno: da `dalle` ogni 15 minuti finché l'inizio è prima di `alle`. */
export function fasceDelGiorno(data: string, turni: Turno[]): Date[] {
  const minuti = new Set<number>()
  for (const t of turni) {
    const dalle = minutiDa(t.dalle), alle = minutiDa(t.alle)
    if (dalle === null || alle === null) continue
    for (let m = dalle; m < alle; m += DURATA_FASCIA) minuti.add(m)
  }
  return [...minuti].sort((a,b) => a - b).map(m => istanteRoma(data,m))
}
export function fasciaPrenotabile(servizio: Servizio, fascia: Date, occupata: { totale: number; domicilio: number }, regole: RegoleFasce, adesso: Date): boolean {
  if (fascia.getTime() < adesso.getTime() + regole.anticipoMinuti * 60000) return false
  if (occupata.totale >= regole.capacitaFascia) return false
  return servizio === 'asporto' || occupata.domicilio < regole.capacitaConsegne
}
export function fascePrenotabili(servizio: Servizio, fasce: Date[], occupazione: Occupazione[], regole: RegoleFasce, adesso: Date): Date[] {
  const vuota = { totale: 0,domicilio: 0 }
  const perFascia = new Map(occupazione.map(o => [new Date(o.fascia).getTime(),o]))
  return fasce.filter(f => fasciaPrenotabile(servizio,f,perFascia.get(f.getTime()) ?? vuota,regole,adesso))
}
/** Fasce dopo l'anticipo minimo che non si possono prenotare perché già piene (da mostrare barrate). */
export function fascePiene(servizio: Servizio, fasce: Date[], occupazione: Occupazione[], regole: RegoleFasce, adesso: Date): Date[] {
  const vuota = { totale: 0,domicilio: 0 }
  const perFascia = new Map(occupazione.map(o => [new Date(o.fascia).getTime(),o]))
  const limite = adesso.getTime() + regole.anticipoMinuti * 60000
  return fasce.filter(f => f.getTime() >= limite && !fasciaPrenotabile(servizio,f,perFascia.get(f.getTime()) ?? vuota,regole,adesso))
}
