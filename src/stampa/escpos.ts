import { aCapo, COLONNE, dueColonne, larghezza, type DocumentoStampa } from './documento'
// Documento neutro → byte ESC/POS (Epson e compatibili). Tabella dei caratteri PC858: lettere accentate italiane ed euro.
const ESC = 0x1b, GS = 0x1d
const INIZIO = [ESC,0x40,ESC,0x74,19] // reset, tabella PC858
const TAGLIO = [ESC,0x64,4,GS,0x56,66,0] // avanza 4 righe e taglia (parziale)

const PC858: Record<string,number> = {
  'à': 0x85,'è': 0x8a,'é': 0x82,'ì': 0x8d,'ò': 0x95,'ó': 0xa2,'ù': 0x97,'À': 0xb7,'È': 0xd4,'É': 0x90,'Ì': 0xde,'Ò': 0xe3,'Ù': 0xeb,
  '€': 0xd5,'°': 0xf8,'ç': 0x87,'ñ': 0xa4,'ü': 0x81,'ö': 0x94,'ä': 0x84,'·': 0xfa,
}
const SOSTITUTI: Record<string,string> = { '’': "'",'‘': "'",'“': '"','”': '"','«': '"','»': '"','–': '-','—': '-','…': '...',' ': ' ','×': 'x' }

/** Testo → byte PC858: ASCII com'è, accentate dalla tabella, il resto «?». Mai byte di controllo dal testo. */
export function codifica(t: string): number[] {
  const byte: number[] = []
  for (const c of t) {
    const s = SOSTITUTI[c] ?? c
    for (const x of s) {
      const n = x.codePointAt(0)!
      if (n >= 0x20 && n < 0x7f) byte.push(n)
      else byte.push(PC858[x] ?? 0x3f)
    }
  }
  return byte
}

export function escpos(doc: DocumentoStampa): Uint8Array {
  const out: number[] = [...INIZIO]
  const stile = (grassetto: boolean, grande: boolean, centrato: boolean, inverso: boolean) =>
    out.push(ESC,0x45,grassetto ? 1 : 0,GS,0x21,grande ? 0x11 : 0,ESC,0x61,centrato ? 1 : 0,GS,0x42,inverso ? 1 : 0)
  const riga = (t: string) => { out.push(...codifica(t),0x0a) }
  for (const r of doc.righe) {
    if (r.tipo === 'vuota') { stile(false,false,false,false); riga('') }
    else if (r.tipo === 'separatore') { stile(false,false,false,false); riga('-'.repeat(COLONNE)) }
    else if (r.tipo === 'testo') {
      const s = r.stile ?? {}
      stile(!!s.grassetto,!!s.grande,!!s.centrato,!!s.inverso)
      // In negativo con uno spazio per lato: la riga deve restare dentro la carta.
      for (const t of aCapo(r.testo,larghezza(s) - (s.inverso ? 2 : 0))) riga(s.inverso ? ` ${t} ` : t)
    } else {
      const s = r.stile ?? {}
      stile(!!s.grassetto,!!s.grande,false,false)
      for (const t of dueColonne(r.sinistra,r.destra,larghezza(s))) riga(t)
    }
  }
  stile(false,false,false,false)
  out.push(...TAGLIO)
  return Uint8Array.from(out)
}

/** Lo stesso documento come testo semplice: anteprima nei test, nel verbale e nella modalità prova del ponte. */
export function testoSemplice(doc: DocumentoStampa): string {
  const righe: string[] = []
  for (const r of doc.righe) {
    if (r.tipo === 'vuota') righe.push('')
    else if (r.tipo === 'separatore') righe.push('-'.repeat(COLONNE))
    else if (r.tipo === 'testo') {
      const max = larghezza(r.stile)
      for (const t of aCapo(r.testo,max)) righe.push(r.stile?.centrato ? t.padStart(Math.floor((max + t.length) / 2)) : t)
    } else righe.push(...dueColonne(r.sinistra,r.destra,larghezza(r.stile)))
  }
  return righe.join('\n')
}
