import { minutiDa, servizioValido } from './fasce'
import { dataValida } from './ora-roma'
import { parseEuro } from './soldi'
import { normalizzaTelefono } from './checkout'
import type { ImpostazioniCasa, DatiZona, Orario, Chiusura } from '@/casa/impostazioni-repo'
type Esito<T> = { ok: true; dati: T } | { ok: false; errore: string }
/** Nomi dei giorni nell'ordine dei numeri usati negli orari (1 = lunedì). */
export const GIORNI = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'] as const
const intero = (v: string | undefined, min: number, max: number): number | null => v !== undefined && /^\d{1,6}$/.test(v.trim()) && +v >= min && +v <= max ? +v : null
export function validaImpostazioni(v: Record<string,string>): Esito<Omit<ImpostazioniCasa,'apertiIl'>> {
  const capacitaFascia = intero(v.capacitaFascia,1,50), capacitaConsegne = intero(v.capacitaConsegne,0,50), anticipoMinuti = intero(v.anticipoMinuti,0,240)
  if (capacitaFascia === null) return { ok: false,errore: 'Ordini per fascia: un numero da 1 a 50.' }
  if (capacitaConsegne === null || capacitaConsegne > capacitaFascia) return { ok: false,errore: 'Consegne per fascia: un numero da 0 al totale degli ordini per fascia.' }
  if (anticipoMinuti === null) return { ok: false,errore: 'Anticipo minimo: da 0 a 240 minuti.' }
  const telefono = v.telefono?.trim() ? normalizzaTelefono(v.telefono) : null
  if (v.telefono?.trim() && !telefono) return { ok: false,errore: 'Scrivi un numero di telefono italiano valido.' }
  return { ok: true,dati: { capacitaFascia,capacitaConsegne,anticipoMinuti,telefono } }
}
export function validaZona(v: Record<string,string>): Esito<DatiZona> {
  const nome = v.nome?.trim() ?? ''
  if (nome.length < 1 || nome.length > 60) return { ok: false,errore: 'Il nome della zona va da 1 a 60 caratteri.' }
  const costoCent = parseEuro(v.costo ?? ''), minimoCent = parseEuro(v.minimo ?? '')
  if (costoCent === null || costoCent > 100000) return { ok: false,errore: 'Costo di consegna non valido.' }
  if (minimoCent === null) return { ok: false,errore: 'Ordine minimo non valido.' }
  const posizione = intero(v.posizione ?? '0',0,999)
  if (posizione === null) return { ok: false,errore: 'Posizione: un numero da 0 a 999.' }
  return { ok: true,dati: { nome,costoCent,minimoCent,attiva: v.attiva === 'on',posizione } }
}
export function validaOrario(v: Record<string,string>): Esito<Omit<Orario,'id'>> {
  const giorno = intero(v.giorno,1,7), dalle = minutiDa(v.dalle), alle = minutiDa(v.alle)
  if (!servizioValido(v.servizio)) return { ok: false,errore: 'Scegli asporto o domicilio.' }
  if (giorno === null) return { ok: false,errore: 'Scegli il giorno.' }
  if (dalle === null || alle === null || dalle >= alle) return { ok: false,errore: 'L’orario d’inizio deve venire prima della fine, nello stesso giorno.' }
  return { ok: true,dati: { servizio: v.servizio,giorno,dalle: v.dalle.slice(0,5),alle: v.alle.slice(0,5) } }
}
export function validaChiusura(v: Record<string,string>): Esito<Chiusura> {
  if (!dataValida(v.data)) return { ok: false,errore: 'Scegli una data valida.' }
  const motivo = v.motivo?.trim() ?? ''
  if (motivo.length > 100) return { ok: false,errore: 'Il motivo può avere al massimo 100 caratteri.' }
  return { ok: true,dati: { data: v.data,motivo: motivo || null } }
}
