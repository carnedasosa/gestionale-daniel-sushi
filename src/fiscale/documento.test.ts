import { describe, expect, it } from 'vitest'
import { descrizioneRiga, ripartisci, righeQuota, totaleRighe, verificaDocumento, type DocumentoCommerciale } from './documento'
import { leggiRispostaEpson, xmlEpson } from './epson'

describe('documento commerciale', () => {
  it('descrizione: numero davanti, al massimo 38 caratteri, senza caratteri di controllo', () => {
    expect(descrizioneRiga('Uramaki salmone',41)).toBe('41 Uramaki salmone')
    expect(descrizioneRiga('Special roll gambero in tempura con salsa spicy',120)).toHaveLength(38)
    expect(descrizioneRiga('a\nb\tc')).toBe('a b c')
  })
  it('ripartizione per reparto: somma esatta, proporzionale, resti ai resti maggiori', () => {
    const pesi = new Map([[1,7000],[2,3000]])
    expect([...ripartisci(1000,pesi)]).toEqual([[1,700],[2,300]])
    expect([...ripartisci(1001,pesi)]).toEqual([[1,701],[2,300]])
    expect([...ripartisci(1,pesi)]).toEqual([[1,1]])
    for (let importo = 1; importo < 3000; importo += 37) for (const p of [new Map([[1,1],[2,1],[3,1]]),new Map([[1,3333],[2,1],[5,6666]])]) {
      const parti = ripartisci(importo,p)
      expect([...parti.values()].reduce((s,x) => s + x,0)).toBe(importo)
      for (const [r,cent] of parti) expect(Math.abs(cent - importo * p.get(r)! / [...p.values()].reduce((s,x) => s + x,0))).toBeLessThan(1)
    }
    expect(() => ripartisci(100,new Map())).toThrow()
  })
  it('righe di una quota: una per reparto, la somma è la quota', () => {
    const righe = righeQuota(3334,new Map([[1,8000],[2,2000]]),'Quota conto Tavolo 5')
    expect(righe).toEqual([{ descrizione: 'Quota conto Tavolo 5',quantita: 1,prezzoUnitCent: 2667,reparto: 1 },{ descrizione: 'Quota conto Tavolo 5',quantita: 1,prezzoUnitCent: 667,reparto: 2 }])
    expect(totaleRighe(righe)).toBe(3334)
  })
  it('verifica: righe che non tornano col pagamento, reparti e quantità non validi', () => {
    const d: DocumentoCommerciale = { righe: [{ descrizione: 'Nigiri',quantita: 2,prezzoUnitCent: 450,reparto: 1 }],pagamento: { metodo: 'contanti',importoCent: 900,indice: 1 } }
    expect(verificaDocumento(d)).toEqual({ ok: true,documento: d })
    expect(verificaDocumento({ ...d,pagamento: { ...d.pagamento,importoCent: 901 } })).toMatchObject({ ok: false })
    expect(verificaDocumento({ ...d,righe: [] })).toMatchObject({ ok: false })
    expect(verificaDocumento({ ...d,righe: [{ ...d.righe[0],reparto: 0 }] })).toMatchObject({ ok: false })
    expect(verificaDocumento({ ...d,righe: [{ ...d.righe[0],quantita: 0 }] })).toMatchObject({ ok: false })
  })
})

describe('Epson fpmate', () => {
  const d: DocumentoCommerciale = { righe: [{ descrizione: '41 Uramaki "salmone" & <avocado>',quantita: 2,prezzoUnitCent: 650,reparto: 1 },{ descrizione: 'Coperto',quantita: 3,prezzoUnitCent: 200,reparto: 1 }],
    pagamento: { metodo: 'carta',importoCent: 1900,indice: 1 } }
  it('busta SOAP, righe col reparto, importi col punto, pagamento elettronico con il suo indice', () => {
    expect(xmlEpson(d)).toBe('<?xml version="1.0" encoding="utf-8"?>\n<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><printerFiscalReceipt>'
      + '<beginFiscalReceipt operator="1" />'
      + '<printRecItem operator="1" description="41 Uramaki &quot;salmone&quot; &amp; &lt;avocado&gt;" quantity="2" unitPrice="6.50" department="1" justification="1" />'
      + '<printRecItem operator="1" description="Coperto" quantity="3" unitPrice="2.00" department="1" justification="1" />'
      + '<printRecTotal operator="1" description="PAGAMENTO ELETTRONICO" payment="19.00" paymentType="2" index="1" justification="1" />'
      + '<endFiscalReceipt operator="1" /></printerFiscalReceipt></s:Body></s:Envelope>')
  })
  it('contanti: paymentType 0, indice 0', () => {
    expect(xmlEpson({ ...d,pagamento: { metodo: 'contanti',importoCent: 1900,indice: 3 } })).toContain('<printRecTotal operator="1" description="CONTANTI" payment="19.00" paymentType="0" index="0" justification="1" />')
  })
  it('risposta: emesso con numero, data e chiusura Z; rifiutato col codice; illeggibile', () => {
    const ok = '<soapenv:Envelope><soapenv:Body><response success="true" code="" status="2"><addInfo><elementList>x</elementList><lastCommand>74</lastCommand><printerStatus>20110</printerStatus>'
      + '<fiscalReceiptNumber>12</fiscalReceiptNumber><fiscalReceiptAmount>19,00</fiscalReceiptAmount><fiscalReceiptDate>29/10/2026</fiscalReceiptDate><zRepNumber>301</zRepNumber></addInfo></response></soapenv:Body></soapenv:Envelope>'
    expect(leggiRispostaEpson(ok)).toEqual({ esito: 'emesso',numero: '12',data: '29/10/2026',z: '301' })
    expect(leggiRispostaEpson('<response success="false" code="EPTR_REC_EMPTY" status="0"></response>')).toEqual({ esito: 'rifiutato',codice: 'EPTR_REC_EMPTY' })
    expect(leggiRispostaEpson('<html>errore</html>')).toEqual({ esito: 'illeggibile' })
    expect(leggiRispostaEpson('<response success="true"/>')).toEqual({ esito: 'emesso',numero: null,data: null,z: null })
  })
})
