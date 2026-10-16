import { servizioValido, type Servizio } from './fasce'
import { parseEuro } from './soldi'
import { idValido } from '@/tavoli/validazione'
export type Pagamento = 'contanti' | 'carta'
/** `email` manca solo negli ordini presi dalla cassa, dettati a voce. */
export interface DatiCheckout {
  tipo: Servizio; zonaId: string | null; indirizzo: string | null; noteConsegna: string | null; fascia: Date
  nome: string; telefono: string; email: string | null; pagamento: Pagamento; contantiDaCent: number | null
}
export type OrigineCheckout = 'cliente' | 'cassa'
export type CampoCheckout = 'tipo' | 'zonaId' | 'indirizzo' | 'noteConsegna' | 'fascia' | 'nome' | 'telefono' | 'email' | 'pagamento' | 'contantiDa' | 'privacy'
export type ErroriCheckout = Partial<Record<CampoCheckout,string>>
export const MASSIMO_CONTANTI_CENT = 50000

/** Telefono italiano: tolti spazi e separatori e il prefisso +39/0039, restano 6–13 cifre. */
export function normalizzaTelefono(testo: unknown): string | null {
  if (typeof testo !== 'string' || testo.length > 40) return null
  let cifre = testo.replace(/[\s.\-()/]/g,'')
  if (cifre.startsWith('+39')) cifre = cifre.slice(3)
  else if (cifre.startsWith('0039')) cifre = cifre.slice(4)
  return /^\d{6,13}$/.test(cifre) ? cifre : null
}
export function normalizzaEmail(testo: unknown): string | null {
  if (typeof testo !== 'string') return null
  const email = testo.trim().toLowerCase()
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
const testo = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length >= min && t.length <= max ? t : null
}
/**
 * Controlla i dati del checkout (non il carrello). I campi del domicilio si ignorano per l'asporto.
 * Dalla cassa l'email è facoltativa, la privacy non si chiede e `forzaFascia` permette un orario già pieno.
 */
export function validaCheckout(v: Record<string,unknown>, { origine = 'cliente' }: { origine?: OrigineCheckout } = {}): { ok: true; dati: DatiCheckout; forzaFascia: boolean } | { ok: false; errori: ErroriCheckout } {
  const errori: ErroriCheckout = {}
  const cassa = origine === 'cassa'
  const tipo = servizioValido(v.tipo) ? v.tipo : null
  if (!tipo) errori.tipo = 'Scegli asporto o domicilio.'
  const domicilio = tipo === 'domicilio'
  const zonaId = domicilio ? (idValido(v.zonaId) ? v.zonaId : null) : null
  if (domicilio && !zonaId) errori.zonaId = 'Scegli la zona di consegna.'
  const indirizzo = domicilio ? testo(v.indirizzo,5,200) : null
  if (domicilio && !indirizzo) errori.indirizzo = 'Scrivi l’indirizzo (da 5 a 200 caratteri).'
  const note = domicilio && typeof v.noteConsegna === 'string' ? v.noteConsegna.trim() : ''
  if (note.length > 200) errori.noteConsegna = 'Al massimo 200 caratteri.'
  const fascia = typeof v.fascia === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(\.000)?Z$/.test(v.fascia) ? new Date(v.fascia) : null
  if (!fascia || !Number.isFinite(fascia.getTime())) errori.fascia = 'Scegli l’orario.'
  const nome = testo(v.nome,1,60)
  if (!nome) errori.nome = 'Scrivi il nome (al massimo 60 caratteri).'
  const telefono = normalizzaTelefono(v.telefono)
  if (!telefono) errori.telefono = 'Scrivi un numero di telefono italiano valido.'
  const emailVuota = cassa && (v.email === undefined || v.email === null || (typeof v.email === 'string' && !v.email.trim()))
  const email = emailVuota ? null : normalizzaEmail(v.email)
  if (!email && !emailVuota) errori.email = 'Scrivi un indirizzo email valido.'
  const pagamento = v.pagamento === 'contanti' || v.pagamento === 'carta' ? v.pagamento : null
  if (!pagamento) errori.pagamento = 'Scegli come pagherai.'
  let contantiDaCent: number | null = null
  if (pagamento === 'contanti' && typeof v.contantiDa === 'string' && v.contantiDa.trim()) {
    contantiDaCent = parseEuro(v.contantiDa)
    if (contantiDaCent === null || contantiDaCent > MASSIMO_CONTANTI_CENT) errori.contantiDa = 'Scrivi un importo valido, al massimo 500,00 €.'
  }
  if (!cassa && v.privacy !== true) errori.privacy = 'Per ordinare devi accettare l’informativa privacy.'
  if (Object.keys(errori).length) return { ok: false,errori }
  return { ok: true,dati: { tipo: tipo!,zonaId,indirizzo,noteConsegna: note || null,fascia: fascia!,nome: nome!,telefono: telefono!,email,pagamento: pagamento!,contantiDaCent },forzaFascia: cassa && v.forzaFascia === true }
}
export interface TotaliCasa { righeCent: number; consegnaCent: number; totaleCent: number; mancanteCent: number }
/** Totale con la consegna; `mancanteCent` > 0 se il domicilio non raggiunge il minimo della zona. */
export function totaliCasa(righeCent: number, tipo: Servizio, zona: { costoCent: number; minimoCent: number } | null): TotaliCasa {
  const consegnaCent = tipo === 'domicilio' && zona ? zona.costoCent : 0
  const mancanteCent = tipo === 'domicilio' && zona ? Math.max(0,zona.minimoCent - righeCent) : 0
  return { righeCent,consegnaCent,totaleCent: righeCent + consegnaCent,mancanteCent }
}
