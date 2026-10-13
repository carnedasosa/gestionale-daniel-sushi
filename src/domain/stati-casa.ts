import type { Servizio } from './fasce'
export type StatoCasa = 'in_attesa' | 'accettato' | 'rifiutato' | 'in_preparazione' | 'pronto' | 'in_consegna' | 'completato' | 'annullato'
export const STATI_CASA: readonly StatoCasa[] = ['in_attesa','accettato','rifiutato','in_preparazione','pronto','in_consegna','completato','annullato']
/** Stati che occupano un posto nella fascia. */
export const STATI_ATTIVI_CASA: readonly StatoCasa[] = ['in_attesa','accettato','in_preparazione','pronto','in_consegna','completato']
export function prossimoStatoCasa(tipo: Servizio, s: StatoCasa): StatoCasa | null {
  if (s === 'accettato') return 'in_preparazione'
  if (s === 'in_preparazione') return 'pronto'
  if (s === 'pronto') return tipo === 'domicilio' ? 'in_consegna' : 'completato'
  if (s === 'in_consegna') return 'completato'
  return null
}
export function puoAnnullareCasa(s: StatoCasa): boolean { return s === 'accettato' || s === 'in_preparazione' || s === 'pronto' || s === 'in_consegna' }
/** Testo del bottone che porta l'ordine allo stato successivo. */
export function azioneAvanzaCasa(tipo: Servizio, s: StatoCasa): string | null {
  const prossimo = prossimoStatoCasa(tipo,s)
  if (!prossimo) return null
  return { in_preparazione: 'In preparazione',pronto: 'Pronto',in_consegna: 'Partito',completato: tipo === 'domicilio' ? 'Consegnato' : 'Ritirato' }[prossimo as 'in_preparazione' | 'pronto' | 'in_consegna' | 'completato']
}
export function etichettaClienteCasa(tipo: Servizio, s: StatoCasa): string {
  if (s === 'pronto') return tipo === 'domicilio' ? 'Pronto, sta per partire' : 'Pronto per il ritiro'
  if (s === 'completato') return tipo === 'domicilio' ? 'Consegnato' : 'Ritirato'
  return { in_attesa: 'In attesa di conferma',accettato: 'Confermato',rifiutato: 'Rifiutato',in_preparazione: 'In preparazione',in_consegna: 'In consegna',annullato: 'Annullato' }[s]
}
export type ColonnaCucina = 'da_preparare' | 'in_preparazione' | 'pronti'
/** Colonna della cucina per tavoli e casa; null se l'ordine non è più in cucina. */
export function colonnaCucina(stato: string): ColonnaCucina | null {
  if (stato === 'inviato' || stato === 'accettato') return 'da_preparare'
  if (stato === 'in_preparazione') return 'in_preparazione'
  if (stato === 'pronto' || stato === 'in_consegna') return 'pronti'
  return null
}
export const MOTIVI_RIFIUTO = ['Zona non servita','Fascia piena','Stiamo chiudendo'] as const
/** Motivo del rifiuto: uno dei motivi rapidi, oppure «Altro» con un testo di 1–200 caratteri. */
export function motivoRifiuto(motivo: unknown, altro: unknown): string | null {
  if (typeof motivo === 'string' && (MOTIVI_RIFIUTO as readonly string[]).includes(motivo)) return motivo
  if (motivo !== 'Altro' || typeof altro !== 'string') return null
  const testo = altro.trim()
  return testo.length >= 1 && testo.length <= 200 ? testo : null
}
export const MINUTI_ATTESA_LUNGA = 10
export function attesaLunga(creatoIl: Date | string, adesso: Date): boolean {
  return adesso.getTime() - new Date(creatoIl).getTime() > MINUTI_ATTESA_LUNGA * 60000
}
export type Avanzamento = 'fatto' | 'attuale' | 'da_fare'
export interface Passo { stato: StatoCasa; etichetta: string; avanzamento: Avanzamento }
const FLUSSO: Record<Servizio,StatoCasa[]> = {
  domicilio: ['in_attesa','accettato','in_preparazione','pronto','in_consegna','completato'],
  asporto: ['in_attesa','accettato','in_preparazione','pronto','completato'],
}
const ETICHETTA_PASSO: Partial<Record<StatoCasa,string>> = { in_attesa: 'Ordine ricevuto',accettato: 'Confermato dal locale',in_preparazione: 'In preparazione',in_consegna: 'In consegna' }
/** Passi della cronologia per il cliente; vuota se l'ordine è rifiutato o annullato. */
export function passiOrdine(tipo: Servizio, stato: StatoCasa): Passo[] {
  const flusso = FLUSSO[tipo], i = flusso.indexOf(stato)
  if (i < 0) return []
  return flusso.map((s,j) => ({ stato: s,etichetta: ETICHETTA_PASSO[s] ?? etichettaClienteCasa(tipo,s),avanzamento: j < i ? 'fatto' : j === i ? 'attuale' : 'da_fare' }))
}
