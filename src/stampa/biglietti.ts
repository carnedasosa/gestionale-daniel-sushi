import { colonne, separatore, testo, vuota, type DocumentoStampa, type RigaStampa } from './documento'
import { ETICHETTA_REPARTO, type Reparto } from '@/domain/reparti'
import { etichettaOrigine, type OrigineOrdine } from '@/domain/origine-ordine'
import type { TipoOrdine } from '@/domain/comande'
import type { SceltePoke } from '@/domain/poke'
import { oraRoma } from '@/domain/ora-roma'
// Biglietti delle comande per i reparti senza schermo: si leggono da un metro, quindi righe grandi e poche parole.

export interface RigaBiglietto { quantita: number; numero: number | null; nome: string; nota: string | null; poke: SceltePoke | null }
export interface DatiComanda {
  reparto: Reparto; numeroGiorno: number; tipo: TipoOrdine; origine: OrigineOrdine; tavoloNome: string | null
  clienteNome: string | null; fascia: Date | null; creatoIl: Date; righe: RigaBiglietto[]; altreRighe: { reparto: Reparto; n: number }[]
}

/** Per chi è il piatto: il tavolo, oppure asporto/domicilio con l'orario. */
export function destinatario(d: Pick<DatiComanda,'tipo' | 'tavoloNome' | 'fascia'>): string {
  if (d.tipo === 'tavolo') return (d.tavoloNome ?? 'Tavolo').toUpperCase()
  return `${d.tipo === 'asporto' ? 'ASPORTO' : 'DOMICILIO'}${d.fascia ? ` ORE ${oraRoma(d.fascia)}` : ''}`
}

function righePiatti(righe: RigaBiglietto[]): RigaStampa[] {
  return righe.flatMap(r => [
    testo(`${r.quantita} x ${r.numero !== null ? `${r.numero} ` : ''}${r.nome}`,{ grande: true,grassetto: true }),
    ...(r.poke ? Object.entries(r.poke).filter(([,scelte]) => scelte.length).map(([gruppo,scelte]) => testo(`  ${gruppo}: ${scelte.join(', ')}`)) : []),
    ...(r.nota ? [testo(`  NOTA: ${r.nota}`,{ grassetto: true })] : []),
  ])
}

export function bigliettoComanda(d: DatiComanda, opzioni: { ristampa?: boolean } = {}): DocumentoStampa {
  const origine = etichettaOrigine(d.origine)
  return { righe: [
    testo(ETICHETTA_REPARTO[d.reparto].toUpperCase(),{ grande: true,centrato: true,inverso: true }),
    ...(opzioni.ristampa ? [testo('RISTAMPA',{ centrato: true,grassetto: true })] : []),
    testo(destinatario(d),{ grande: true,grassetto: true }),
    ...(d.tipo !== 'tavolo' && d.clienteNome ? [testo(d.clienteNome,{ grassetto: true })] : []),
    colonne(`N. ${d.numeroGiorno}${origine ? ` · ${origine}` : ''}`,oraRoma(d.creatoIl)),
    separatore,
    ...righePiatti(d.righe),
    separatore,
    ...(d.altreRighe.length ? [testo(`Altri reparti: ${d.altreRighe.map(a => `${ETICHETTA_REPARTO[a.reparto].toLowerCase()} ${a.n}`).join(', ')}`)] : []),
    vuota,
  ] }
}

/** Biglietto ANNULLATO per un reparto che ha già la comanda in mano: solo le righe tolte. */
export function bigliettoAnnullo(d: Omit<DatiComanda,'altreRighe' | 'clienteNome' | 'origine'>, adesso: Date): DocumentoStampa {
  return { righe: [
    testo('ANNULLATO',{ grande: true,centrato: true,inverso: true }),
    testo(`${ETICHETTA_REPARTO[d.reparto].toUpperCase()} · ${destinatario(d)}`,{ grassetto: true }),
    colonne(`N. ${d.numeroGiorno} delle ${oraRoma(d.creatoIl)}`,oraRoma(adesso)),
    separatore,
    ...righePiatti(d.righe),
    separatore,
    testo('Non preparare questi piatti.',{ grassetto: true }),
    vuota,
  ] }
}
