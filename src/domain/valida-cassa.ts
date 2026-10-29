import { parseEuro } from './soldi'
import { MAX_COPERTO_CENT } from './coperti'
import type { ImpostazioniCassa } from '@/cassa/impostazioni-repo'
type Esito<T> = { ok: true; dati: T } | { ok: false; errore: string }

export function validaImpostazioniCassa(v: Record<string,string>): Esito<ImpostazioniCassa> {
  const copertoCent = (v.coperto ?? '').trim() === '' ? 0 : parseEuro(v.coperto)
  if (copertoCent === null || copertoCent > MAX_COPERTO_CENT) return { ok: false,errore: 'Coperto: un importo da 0 a 20 €.' }
  return { ok: true,dati: { copertoCent } }
}
