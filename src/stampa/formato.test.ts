import { describe, expect, it } from 'vitest'
import { aCapo, colonne, dueColonne, separatore, testo } from './documento'
import { codifica, escpos, testoSemplice } from './escpos'
import { bigliettoAnnullo, bigliettoComanda, destinatario, type DatiComanda } from './biglietti'
import { allarmeStampa, esitoScadenza, stampanteDelLavoro, stampanteDelReparto } from './instradamento'

describe('documento', () => {
  it('va a capo sulle parole e spezza quelle troppo lunghe', () => {
    expect(aCapo('Uramaki salmone e avocado con salsa teriyaki',24)).toEqual(['Uramaki salmone e','avocado con salsa','teriyaki'])
    expect(aCapo('x'.repeat(30),24)).toEqual(['x'.repeat(24),'x'.repeat(6)])
    expect(aCapo('  ',24)).toEqual([''])
  })
  it('due colonne: la destra sempre al margine', () => {
    expect(dueColonne('N. 12','20:41',20)).toEqual(['N. 12          20:41'])
    const righe = dueColonne('Nigiri salmone con tanta salsa','12,00',20)
    expect(righe.at(-1)!.endsWith('12,00')).toBe(true)
    expect(righe.every(r => r.length <= 20)).toBe(true)
  })
})

describe('ESC/POS', () => {
  it('inizia con reset e tabella PC858, finisce col taglio', () => {
    const b = Array.from(escpos({ righe: [testo('Ciao')] }))
    expect(b.slice(0,5)).toEqual([0x1b,0x40,0x1b,0x74,19])
    expect(b.slice(-7)).toEqual([0x1b,0x64,4,0x1d,0x56,66,0])
    expect(Buffer.from(Uint8Array.from(b)).includes(Buffer.from('Ciao\n'))).toBe(true)
  })
  it('accentate ed euro in PC858; caratteri di controllo e simboli ignoti non passano', () => {
    expect(codifica('àèéìòù€')).toEqual([0x85,0x8a,0x82,0x8d,0x95,0x97,0xd5])
    expect(codifica('a\x1bb\n')).toEqual([0x61,0x3f,0x62,0x3f])
    expect(codifica('sushi 🍣')).toEqual([...Buffer.from('sushi '),0x3f])
    expect(codifica('l’«ok»—1×2')).toEqual([...Buffer.from(`l'"ok"-1x2`)])
  })
  it('grassetto e grande diventano ESC E e GS !', () => {
    const b = Buffer.from(escpos({ righe: [testo('X',{ grande: true,grassetto: true })] }))
    expect(b.includes(Buffer.from([0x1b,0x45,1,0x1d,0x21,0x11]))).toBe(true)
  })
})

const comanda: DatiComanda = {
  reparto: 'banco',numeroGiorno: 12,tipo: 'tavolo',origine: 'cameriere',tavoloNome: 'Tavolo 5',clienteNome: null,fascia: null,
  creatoIl: new Date('2026-10-29T19:41:00Z'),
  righe: [{ quantita: 2,numero: 41,nome: 'Uramaki salmone',nota: 'senza sesamo',poke: null },{ quantita: 1,numero: null,nome: 'Poke composta',nota: null,poke: { Base: ['Riso'],Proteine: ['Salmone','Tonno'] } }],
  altreRighe: [{ reparto: 'cucina',n: 2 }],
}
describe('biglietti', () => {
  it('comanda del banco: reparto, tavolo, numero e ora di Roma, righe grandi, note, poke e altri reparti', () => {
    expect(testoSemplice(bigliettoComanda(comanda))).toBe([
      '      BANCO SUSHI',
      'TAVOLO 5',
      'N. 12 · Dal cameriere                      20:41',
      '-'.repeat(48),
      '2 x 41 Uramaki salmone',
      '  NOTA: senza sesamo',
      '1 x Poke composta',
      '  Base: Riso',
      '  Proteine: Salmone, Tonno',
      '-'.repeat(48),
      'Altri reparti: cucina 2',
      '',
    ].join('\n'))
  })
  it('asporto e domicilio: tipo e orario della fascia, nome del cliente; ristampa segnata', () => {
    const casa = { ...comanda,tipo: 'asporto' as const,tavoloNome: null,clienteNome: 'Anna',fascia: new Date('2026-10-29T18:30:00Z'),origine: 'cassa' as const }
    const t = testoSemplice(bigliettoComanda(casa,{ ristampa: true }))
    expect(t).toContain('ASPORTO ORE 19:30'); expect(t).toContain('Anna'); expect(t).toContain('RISTAMPA'); expect(t).toContain('Dalla cassa')
    expect(destinatario({ tipo: 'domicilio',tavoloNome: null,fascia: new Date('2026-10-29T19:00:00Z') })).toBe('DOMICILIO ORE 20:00')
  })
  it('annullo: in negativo, reparto e destinatario, solo le righe tolte', () => {
    const t = testoSemplice(bigliettoAnnullo({ ...comanda,righe: [comanda.righe[0]] },new Date('2026-10-29T19:55:00Z')))
    expect(t).toContain('ANNULLATO'); expect(t).toContain('BANCO SUSHI · TAVOLO 5'); expect(t).toContain('N. 12 delle 20:41'); expect(t).toContain('20:55')
    expect(t).toContain('2 x 41 Uramaki salmone'); expect(t).not.toContain('Poke composta')
  })
  it('nessuna riga supera la carta da 80 mm', () => {
    const lunga = { ...comanda,righe: [{ quantita: 3,numero: 120,nome: 'Special roll gambero in tempura con salsa spicy e granella di pistacchio',nota: 'x'.repeat(150),poke: null }] }
    const doc = bigliettoComanda(lunga)
    for (const r of testoSemplice(doc).split('\n')) expect(r.length).toBeLessThanOrEqual(48)
    for (const r of doc.righe) if (r.tipo === 'testo' && r.stile?.grande) for (const x of aCapo(r.testo,24)) expect(x.length).toBeLessThanOrEqual(24)
    expect(testoSemplice({ righe: [separatore,colonne('a','b')] }).split('\n').every(r => r.length === 48)).toBe(true)
  })
})

describe('instradamento', () => {
  const tutti = { banco: true,cucina: true,sala: true }, nessuno = { banco: false,cucina: false,sala: false }
  it('ogni reparto alla sua stampante, le bevande alla cassa; spento = schermo', () => {
    expect(stampanteDelReparto('banco',tutti)).toBe('banco')
    expect(stampanteDelReparto('cucina',tutti)).toBe('cucina')
    expect(stampanteDelReparto('sala',tutti)).toBe('cassa')
    for (const r of ['banco','cucina','sala'] as const) expect(stampanteDelReparto(r,nessuno)).toBeNull()
    expect(stampanteDelReparto('cucina',{ ...nessuno,banco: true })).toBeNull()
    expect(stampanteDelLavoro('preconto')).toBe('cassa'); expect(stampanteDelLavoro('scontrino')).toBe('fiscale'); expect(stampanteDelLavoro('prova')).toBe('cassa')
  })
  it('un lavoro fiscale scaduto non riparte da solo', () => {
    expect(esitoScadenza('fiscale')).toBe('incerta')
    for (const s of ['cassa','banco','cucina'] as const) expect(esitoScadenza(s)).toBe('in_coda')
  })
  it('allarme alla cassa: incerti, ponte zitto, coda ferma, errori; niente se la stampa non si usa', () => {
    const adesso = new Date('2026-10-29T20:00:00Z'), poco = new Date('2026-10-29T19:59:55Z'), tanto = new Date('2026-10-29T19:58:00Z')
    const base = { ponteVistoIl: poco,inCoda: 0,piuVecchia: null,errori: 0,incerte: 0 }
    expect(allarmeStampa(base,true,adesso)).toBeNull()
    expect(allarmeStampa({ ...base,ponteVistoIl: null },false,adesso)).toBeNull()
    expect(allarmeStampa({ ...base,ponteVistoIl: null },true,adesso)?.tipo).toBe('ponte')
    expect(allarmeStampa({ ...base,ponteVistoIl: tanto },true,adesso)?.tipo).toBe('ponte')
    expect(allarmeStampa({ ...base,inCoda: 2,piuVecchia: tanto },true,adesso)).toMatchObject({ tipo: 'coda',testo: expect.stringContaining('2 stampe ferme') })
    expect(allarmeStampa({ ...base,inCoda: 1,piuVecchia: poco },true,adesso)).toBeNull()
    expect(allarmeStampa({ ...base,errori: 1 },true,adesso)?.tipo).toBe('errori')
    expect(allarmeStampa({ ...base,incerte: 1,ponteVistoIl: null },false,adesso)).toMatchObject({ tipo: 'incerte',testo: expect.stringContaining('Uno scontrino') })
  })
})
