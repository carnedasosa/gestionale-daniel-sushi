import type { Reparto } from './reparti'
// Postazione: che cosa fa il dispositivo dello staff. La cassa vede tutto; banco e cucina solo le
// proprie comande; la sala (telefoni dei camerieri) è la cassa senza accettazioni sonore, senza
// interruttore degli ordini online e senza «Nuovo ordine».
export const POSTAZIONI = ['cassa','banco','cucina','sala'] as const
export type Postazione = typeof POSTAZIONI[number]
export type SchedaStaff = 'ordini' | 'tavoli' | 'conti' | 'menu'

export const ETICHETTA_POSTAZIONE: Record<Postazione,string> = { cassa: 'Cassa',banco: 'Banco sushi',cucina: 'Cucina',sala: 'Sala' }

/**
 * Cookie della postazione: lo legge il server per caricare solo i dati giusti e rendere le colonne
 * corrette al primo disegno (localStorage non arriverebbe al server). Vale solo sotto /staff.
 */
export const COOKIE_POSTAZIONE = 'ds_postazione'
export const OPZIONI_COOKIE_POSTAZIONE = { path: '/staff',sameSite: 'lax' as const,httpOnly: true,maxAge: 365 * 24 * 60 * 60 }

export function postazioneValida(v: unknown): v is Postazione {
  return typeof v === 'string' && (POSTAZIONI as readonly string[]).includes(v)
}

/** `?postazione=` vince sul cookie senza scriverlo (prove e cambi al volo); senza nessuno dei due, cassa. */
export function postazioneDa(query: unknown, cookie: unknown): Postazione {
  return postazioneValida(query) ? query : postazioneValida(cookie) ? cookie : 'cassa'
}

const SCHEDE: Record<Postazione,readonly SchedaStaff[]> = {
  cassa: ['ordini','tavoli','conti','menu'],
  banco: ['ordini','menu'],
  cucina: ['ordini','menu'],
  sala: ['ordini','tavoli','conti'],
}
export function schedePostazione(p: Postazione): readonly SchedaStaff[] { return SCHEDE[p] }

/** Reparto di cui la postazione vede le comande; null per cassa e sala, che vedono gli ordini interi. */
export function repartoDellaPostazione(p: Postazione): Exclude<Reparto,'sala'> | null {
  return p === 'banco' || p === 'cucina' ? p : null
}

/** Solo la cassa suona ogni 10 secondi per gli ordini da casa da accettare, apre gli ordini online e prende ordini al telefono. */
export function suonaAccettare(p: Postazione): boolean { return p === 'cassa' }
export function onlineAmmesso(p: Postazione): boolean { return p === 'cassa' }
export function nuovoOrdineAmmesso(p: Postazione): boolean { return p === 'cassa' }
