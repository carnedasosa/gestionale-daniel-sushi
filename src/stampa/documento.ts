// Documento di stampa neutro: righe di testo con pochi stili. Lo traduce in byte la stampante (ESC/POS oggi),
// così biglietti e instradamento non dipendono dalla marca.
export const COLONNE = 48 // carattere normale su carta da 80 mm
export interface Stile { grande?: boolean; grassetto?: boolean; centrato?: boolean; inverso?: boolean }
export type RigaStampa =
  | { tipo: 'testo'; testo: string; stile?: Stile }
  | { tipo: 'colonne'; sinistra: string; destra: string; stile?: Pick<Stile,'grassetto' | 'grande'> }
  | { tipo: 'separatore' }
  | { tipo: 'vuota' }
export interface DocumentoStampa { righe: RigaStampa[] }

export const testo = (t: string, stile?: Stile): RigaStampa => ({ tipo: 'testo',testo: t,stile })
export const colonne = (sinistra: string, destra: string, stile?: Pick<Stile,'grassetto' | 'grande'>): RigaStampa => ({ tipo: 'colonne',sinistra,destra,stile })
export const separatore: RigaStampa = { tipo: 'separatore' }
export const vuota: RigaStampa = { tipo: 'vuota' }

/** Caratteri per riga con lo stile dato: il testo grande è a doppia larghezza. */
export const larghezza = (stile?: { grande?: boolean }) => stile?.grande ? COLONNE / 2 : COLONNE

/**
 * A capo sulle parole; le parole più lunghe della riga si spezzano. Il rientro iniziale (note, scelte della poke)
 * si ripete su ogni riga. Un testo vuoto dà una riga vuota.
 */
export function aCapo(t: string, max: number): string[] {
  const rientro = /^ */.exec(t)![0].slice(0,Math.floor(max / 2))
  return aCapoSenzaRientro(t,max - rientro.length).map(r => r ? rientro + r : r)
}
function aCapoSenzaRientro(t: string, max: number): string[] {
  const parole = t.replace(/\s+/g,' ').trim().split(' ').filter(Boolean).flatMap(p => p.length > max ? p.match(new RegExp(`.{1,${max}}`,'g'))! : [p])
  const righe: string[] = []
  for (const p of parole) {
    const ultima = righe.at(-1)
    if (ultima !== undefined && ultima.length + 1 + p.length <= max) righe[righe.length - 1] = `${ultima} ${p}`
    else righe.push(p)
  }
  return righe.length ? righe : ['']
}

/** Due colonne: la destra allineata al margine, la sinistra va a capo prima di toccarla. */
export function dueColonne(sinistra: string, destra: string, max: number): string[] {
  const spazio = Math.max(1,max - destra.length - 1)
  const righe = aCapo(sinistra,spazio)
  const ultima = righe.pop()!
  return [...righe,ultima.padEnd(max - destra.length,' ') + destra]
}
