import type { Servizio } from './fasce'
export type MotivoChiusura = 'allergeni' | 'telefono' | 'spenti' | 'chiusura' | 'zone' | 'fasce'
export interface DatiApertura {
  allergeniCompleti: boolean; telefono: string | null; apertiIl: string | null; oggi: string
  chiusoOggi: boolean; zoneAttive: number; fasceLibere: number; prova: boolean
}
export type StatoApertura = { aperto: true } | { aperto: false; motivo: MotivoChiusura }
export const TESTO_MOTIVO: Record<MotivoChiusura,string> = {
  allergeni: 'Stiamo aggiornando le informazioni sugli allergeni: gli ordini online riapriranno presto.',
  telefono: 'Ordini online non ancora attivi.',
  spenti: 'Ordini online chiusi in questo momento.',
  chiusura: 'Oggi siamo chiusi.',
  zone: 'Consegne a domicilio non disponibili.',
  fasce: 'Nessuna fascia libera per oggi.',
}
/** Primo motivo per cui il servizio è chiuso, nell'ordine della spec (§5.1). */
export function aperturaServizio(servizio: Servizio, d: DatiApertura): StatoApertura {
  if (!d.allergeniCompleti && !d.prova) return { aperto: false,motivo: 'allergeni' }
  if (!d.telefono) return { aperto: false,motivo: 'telefono' }
  if (d.apertiIl !== d.oggi) return { aperto: false,motivo: 'spenti' }
  if (d.chiusoOggi) return { aperto: false,motivo: 'chiusura' }
  if (servizio === 'domicilio' && d.zoneAttive === 0) return { aperto: false,motivo: 'zone' }
  if (d.fasceLibere === 0) return { aperto: false,motivo: 'fasce' }
  return { aperto: true }
}
/** Prova in locale senza allergeni confermati: mai in produzione. */
export function modalitaProva(env: { NODE_ENV?: string; ORDINI_CASA_PROVA?: string }): boolean {
  return env.ORDINI_CASA_PROVA === '1' && env.NODE_ENV !== 'production'
}
export interface Requisito { chiave: 'telefono' | 'allergeni' | 'poke' | 'zone'; ok: boolean; blocca: boolean; testo: string; link: { href: string; testo: string } | null }
/** Cosa manca per aprire gli ordini da casa: mostra i controlli di aperturaServizio, non li sostituisce. */
export function requisitiCasa(d: { telefono: string | null; allergeniCompleti: boolean; pokeConfermati: boolean | null; zoneAttive: number }): Requisito[] {
  const voci: Requisito[] = [
    d.telefono ? { chiave: 'telefono',ok: true,blocca: true,testo: 'Telefono del locale impostato',link: null }
      : { chiave: 'telefono',ok: false,blocca: true,testo: 'Manca il telefono del locale: senza, gli ordini online non si aprono',link: { href: '#impostazioni',testo: 'Imposta il telefono' } },
    d.allergeniCompleti ? { chiave: 'allergeni',ok: true,blocca: true,testo: 'Allergeni del menù confermati',link: null }
      : { chiave: 'allergeni',ok: false,blocca: true,testo: 'Ci sono piatti disponibili con allergeni da confermare',link: { href: '/admin/menu?filtro=allergeni',testo: 'Conferma nel menù' } },
  ]
  if (d.pokeConfermati !== null) voci.push(d.pokeConfermati ? { chiave: 'poke',ok: true,blocca: false,testo: 'Allergeni degli ingredienti della poke confermati',link: null }
    : { chiave: 'poke',ok: false,blocca: false,testo: 'La poke composta resta chiusa da casa finché non confermi gli allergeni degli ingredienti',link: { href: '/admin/poke',testo: 'Vai alla poke' } })
  voci.push(d.zoneAttive > 0 ? { chiave: 'zone',ok: true,blocca: false,testo: 'Almeno una zona di consegna attiva',link: null }
    : { chiave: 'zone',ok: false,blocca: false,testo: 'Nessuna zona attiva: il domicilio resta chiuso, l’asporto no',link: { href: '#zone',testo: 'Aggiungi una zona' } })
  return voci
}
