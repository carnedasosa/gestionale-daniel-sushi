import { expect, it } from 'vitest'
import { componiEmail, escapeHtml, type DatiEmail } from './email-ordini'
const base: DatiEmail = { tipo: 'ricevuto',numero: 12,servizio: 'domicilio',fascia: new Date('2026-10-12T17:15:00Z'),nome: 'Anna',totaleCent: 2000,consegnaCent: 200,zonaNome: 'Bitetto',
  indirizzo: 'Via Roma 1',pagamento: 'contanti',motivoRifiuto: null,righe: [{ quantita: 3,nome: 'Salmone',prezzoUnitCent: 600,annullata: false },{ quantita: 1,nome: 'Tonno',prezzoUnitCent: 700,annullata: true }],
  link: 'https://ordini.esempio.it/ordine/abc',telefono: '0801234567' }
it('ricevuto: riepilogo senza righe annullate, consegna, pagamento, link e telefono', () => {
  const e = componiEmail(base)
  expect(e.oggetto).toBe('Abbiamo ricevuto il tuo ordine n. 12')
  expect(e.testo).toContain('3 × Salmone · 18,00 €'); expect(e.testo).toContain('Consegna · 2,00 €'); expect(e.testo).not.toContain('Tonno')
  expect(e.testo).toContain('Totale 20,00 €, da pagare alla consegna (contanti).'); expect(e.testo).toContain('https://ordini.esempio.it/ordine/abc'); expect(e.testo).toContain('Tel. 0801234567')
})
it('accettato con l’ora di Roma, per domicilio e per asporto', () => {
  expect(componiEmail({ ...base,tipo: 'accettato' })).toMatchObject({ oggetto: 'Ordine n. 12 confermato per le 19:15',testo: expect.stringContaining('lo consegniamo verso le 19:15 in Via Roma 1 (Bitetto)') })
  expect(componiEmail({ ...base,tipo: 'accettato',servizio: 'asporto',consegnaCent: 0 }).testo).toContain('pronto per il ritiro alle 19:15')
  expect(componiEmail({ ...base,servizio: 'asporto',consegnaCent: 0,pagamento: 'carta' }).testo).toContain('da pagare al ritiro (carta)')
})
it('rifiutato con motivo e annullato', () => {
  expect(componiEmail({ ...base,tipo: 'rifiutato',motivoRifiuto: 'Fascia piena' })).toMatchObject({ oggetto: 'Ordine n. 12 non accettato',testo: expect.stringContaining('Motivo: Fascia piena') })
  expect(componiEmail({ ...base,tipo: 'annullato',telefono: null })).toMatchObject({ oggetto: 'Ordine n. 12 annullato',testo: expect.not.stringContaining('Tel.') })
})
it('nell’HTML i dati del cliente non possono iniettare markup', () => {
  const html = componiEmail({ ...base,nome: '<script>alert(1)</script>',indirizzo: '"><img src=x>',tipo: 'accettato' }).html
  expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).toContain('&lt;script&gt;')
  expect(escapeHtml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;')
})
