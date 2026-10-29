import { parseEuro } from './soldi'
import { MAX_COPERTO_CENT } from './coperti'
import type { ImpostazioniCassa } from '@/cassa/impostazioni-repo'
import type { ImpostazioniFiscali } from '@/fiscale/scontrini-repo'
type Esito<T> = { ok: true; dati: T } | { ok: false; errore: string }

export function validaImpostazioniCassa(v: Record<string,string>): Esito<ImpostazioniCassa> {
  const copertoCent = (v.coperto ?? '').trim() === '' ? 0 : parseEuro(v.coperto)
  if (copertoCent === null || copertoCent > MAX_COPERTO_CENT) return { ok: false,errore: 'Coperto: un importo da 0 a 20 €.' }
  return { ok: true,dati: { copertoCent,stampa: { banco: v.stampaBanco === 'on',cucina: v.stampaCucina === 'on',sala: v.stampaSala === 'on' } } }
}

const reparto = (v: string | undefined): number | null => v !== undefined && /^\d{1,2}$/.test(v.trim()) && +v >= 1 && +v <= 99 ? +v : null
/** Registratore telematico: reparti fiscali (1–99, come programmati sull'RT) per coperto, consegna e ogni categoria. */
export function validaImpostazioniFiscali(v: Record<string,string>, categorie: string[]): Esito<{ impostazioni: ImpostazioniFiscali; categorie: Record<string,number> }> {
  const repartoCoperto = reparto(v.repartoCoperto), repartoConsegna = reparto(v.repartoConsegna), indiceCarta = reparto(v.indiceCarta)
  if (repartoCoperto === null || repartoConsegna === null) return { ok: false,errore: 'Reparti del coperto e della consegna: un numero da 1 a 99.' }
  if (indiceCarta === null) return { ok: false,errore: 'Indice del pagamento elettronico: un numero da 1 a 99.' }
  const perCategoria: Record<string,number> = {}
  for (const id of categorie) {
    const n = reparto(v[`reparto:${id}`])
    if (n === null) return { ok: false,errore: 'Ogni categoria vuole un reparto fiscale da 1 a 99.' }
    perCategoria[id] = n
  }
  return { ok: true,dati: { impostazioni: { repartoCoperto,repartoConsegna,indiceCarta,automatico: v.automatico === 'on' },categorie: perCategoria } }
}
