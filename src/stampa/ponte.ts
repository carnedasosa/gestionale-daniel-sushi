import { autorizzatoCron } from '@/casa/cron'
import { escpos, testoSemplice } from './escpos'
import type { DocumentoStampa } from './documento'
import type { Stampante, TipoLavoro } from './instradamento'
// Che cosa riceve il ponte di stampa: byte già pronti per la stampante, così il ponte fa solo trasporto.

/** `Authorization: Bearer <STAMPA_TOKEN>`; il token deve avere almeno 32 caratteri, senza token non passa nessuno. */
export function autorizzatoPonte(intestazione: string | null, token: string | undefined): boolean {
  return !!token && token.length >= 32 && autorizzatoCron(intestazione,token)
}

export interface LavoroPerPonte {
  id: string; stampante: Stampante; tipo: TipoLavoro
  /** `escpos`: byte in base64 da mandare alla porta 9100; `fpmate`: XML da mandare al registratore telematico. */
  formato: 'escpos' | 'fpmate'; dati: string
  /** Testo leggibile: lo usa la modalità prova del ponte e aiuta a capire che cosa è uscito. */
  anteprima: string
}
export function perIlPonte(l: { id: string; stampante: Stampante; tipo: TipoLavoro; documento: unknown }): LavoroPerPonte {
  const doc = l.documento as DocumentoStampa
  return { id: l.id,stampante: l.stampante,tipo: l.tipo,formato: 'escpos',dati: Buffer.from(escpos(doc)).toString('base64'),anteprima: testoSemplice(doc) }
}

export type EsitoDalPonte = { id: string; ok: true; risposta?: string } | { id: string; ok: false; errore: string; incerto?: boolean; risposta?: string }
/** Corpo di POST /api/stampa/esito: controlli di forma, il resto lo decide il repository. */
export function esitoValido(v: unknown): v is EsitoDalPonte {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string,unknown>
  if (typeof x.id !== 'string' || typeof x.ok !== 'boolean') return false
  if (x.risposta !== undefined && (typeof x.risposta !== 'string' || x.risposta.length > 20000)) return false
  if (!x.ok && (typeof x.errore !== 'string' || x.errore.length > 1000)) return false
  if (x.incerto !== undefined && typeof x.incerto !== 'boolean') return false
  return true
}
