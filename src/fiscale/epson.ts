import type { DocumentoCommerciale } from './documento'
// Driver sottile per i registratori telematici Epson (FP-81 II RT, FP-90 III RT): XML del servizio fpmate.cgi.
// Comandi e attributi come nel driver aperto OCA «fiscal_epos_print» (Odoo), usato in produzione in Italia:
// beginFiscalReceipt, printRecItem (description, quantity, unitPrice, department), printRecTotal (payment, paymentType, index),
// endFiscalReceipt. paymentType: 0 contanti, 2 carta/credito (index = pagamento elettronico programmato sull'RT).
// Da verificare sul registratore di Daniele prima dell'uso reale (vedi docs/superpowers/specs/2026-10-29-cassa-fiscale-e-stampe-design.md).

const xml = (t: string) => t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const importo = (cent: number) => (cent / 100).toFixed(2)

export function xmlEpson(d: DocumentoCommerciale, operatore = '1'): string {
  const op = `operator="${xml(operatore)}"`
  const righe = d.righe.map(r => `<printRecItem ${op} description="${xml(r.descrizione)}" quantity="${r.quantita}" unitPrice="${importo(r.prezzoUnitCent)}" department="${r.reparto}" justification="1" />`)
  const carta = d.pagamento.metodo === 'carta'
  const totale = `<printRecTotal ${op} description="${carta ? 'PAGAMENTO ELETTRONICO' : 'CONTANTI'}" payment="${importo(d.pagamento.importoCent)}" paymentType="${carta ? 2 : 0}" index="${carta ? d.pagamento.indice : 0}" justification="1" />`
  return `<?xml version="1.0" encoding="utf-8"?>\n<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><printerFiscalReceipt>`
    + `<beginFiscalReceipt ${op} />${righe.join('')}${totale}<endFiscalReceipt ${op} /></printerFiscalReceipt></s:Body></s:Envelope>`
}

export type RispostaRt = { esito: 'emesso'; numero: string | null; data: string | null; z: string | null } | { esito: 'rifiutato'; codice: string } | { esito: 'illeggibile' }
const tag = (t: string, nome: string) => new RegExp(`<${nome}>([^<]*)</${nome}>`).exec(t)?.[1]?.trim() || null
/**
 * Risposta di fpmate.cgi: `<response success="true|false" code="…">` con `addInfo` (fiscalReceiptNumber, fiscalReceiptDate,
 * zRepNumber). «rifiutato» = l'RT ha detto di no (lo scontrino non è uscito); «illeggibile» = non si sa, da controllare.
 */
export function leggiRispostaEpson(t: string): RispostaRt {
  const r = /<response\b[^>]*\bsuccess="(true|false)"[^>]*>/i.exec(t)
  if (!r) return { esito: 'illeggibile' }
  if (r[1].toLowerCase() === 'false') return { esito: 'rifiutato',codice: /\bcode="([^"]*)"/.exec(r[0])?.[1] || 'sconosciuto' }
  return { esito: 'emesso',numero: tag(t,'fiscalReceiptNumber'),data: tag(t,'fiscalReceiptDate'),z: tag(t,'zRepNumber') }
}
