import type { Servizio } from './fasce'
import { formatEuro } from './soldi'
import { oraRoma } from './ora-roma'
export type TipoEmail = 'ricevuto' | 'accettato' | 'rifiutato' | 'annullato'
export interface DatiEmail {
  tipo: TipoEmail; numero: number; servizio: Servizio; fascia: Date; nome: string; totaleCent: number; consegnaCent: number
  zonaNome: string | null; indirizzo: string | null; pagamento: 'contanti' | 'carta'; motivoRifiuto: string | null
  righe: { quantita: number; nome: string; prezzoUnitCent: number; annullata: boolean }[]; link: string; telefono: string | null
}
export interface Email { oggetto: string; testo: string; html: string }
export function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
function frasi(d: DatiEmail): { oggetto: string; apertura: string } {
  const ora = oraRoma(d.fascia), n = `Ordine n. ${d.numero}`
  if (d.tipo === 'ricevuto') return { oggetto: `Abbiamo ricevuto il tuo ordine n. ${d.numero}`,apertura: 'abbiamo ricevuto il tuo ordine. Ti scriviamo appena lo confermiamo: puoi seguirlo anche dalla pagina dell’ordine.' }
  if (d.tipo === 'accettato') return { oggetto: `${n} confermato per le ${ora}`,apertura: d.servizio === 'domicilio'
    ? `il tuo ordine è confermato: lo consegniamo verso le ${ora} in ${d.indirizzo ?? ''} (${d.zonaNome ?? ''}).`
    : `il tuo ordine è confermato: sarà pronto per il ritiro alle ${ora} in Via Beato Giacomo 72, Bitetto.` }
  if (d.tipo === 'rifiutato') return { oggetto: `${n} non accettato`,apertura: `purtroppo non possiamo accettare il tuo ordine${d.motivoRifiuto ? `. Motivo: ${d.motivoRifiuto}` : ''}. Ci scusiamo per il disagio.` }
  return { oggetto: `${n} annullato`,apertura: 'il tuo ordine è stato annullato. Per qualsiasi domanda chiamaci.' }
}
/** Oggetto, testo semplice e HTML di un'email al cliente; i dati del cliente sono sempre «escapati» nell'HTML. */
export function componiEmail(d: DatiEmail): Email {
  const { oggetto,apertura } = frasi(d)
  const righe = d.righe.filter(r => !r.annullata).map(r => `${r.quantita} × ${r.nome} · ${formatEuro(r.prezzoUnitCent * r.quantita)}`)
  if (d.consegnaCent > 0) righe.push(`Consegna · ${formatEuro(d.consegnaCent)}`)
  const pagamento = `Totale ${formatEuro(d.totaleCent)}, da pagare ${d.servizio === 'domicilio' ? 'alla consegna' : 'al ritiro'} (${d.pagamento === 'carta' ? 'carta' : 'contanti'}).`
  const contatti = `Daniel's Sushi · Via Beato Giacomo 72, Bitetto${d.telefono ? ` · Tel. ${d.telefono}` : ''}`
  const testo = [`Ciao ${d.nome},`,apertura,'',...righe,pagamento,'',`Segui l’ordine: ${d.link}`,'',contatti].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1c1c1e;max-width:560px">
<p>Ciao ${escapeHtml(d.nome)},</p><p>${escapeHtml(apertura)}</p>
<ul>${righe.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul><p><strong>${escapeHtml(pagamento)}</strong></p>
<p><a href="${escapeHtml(d.link)}">Segui l’ordine</a></p><p style="color:#6c6c70;font-size:14px">${escapeHtml(contatti)}</p></div>`
  return { oggetto,testo,html }
}
