import type { Db } from '@/server/db-tipi'
import { fasceDelGiorno, fascePiene, fascePrenotabili, SERVIZI, type Occupazione, type RegoleFasce, type Servizio } from '@/domain/fasce'
import { aperturaServizio, type StatoApertura } from '@/domain/apertura-casa'
import { dataRoma, giornoSettimana, istanteRoma } from '@/domain/ora-roma'
import { STATI_ATTIVI_CASA } from '@/domain/stati-casa'
import { pokeOrdinabile } from '@/domain/poke'
import type { AllergeniVoci } from '@/domain/allergeni-poke'
import type { PokeConfig } from '@/menu/importa'
import { leggiAllergeniPoke, leggiPokeConfig } from '@/tavoli/poke-repo'
import { allergeniCompleti, chiusoIl, elencoZone, leggiImpostazioni, turniDelGiorno, type Zona } from './impostazioni-repo'
/** `piene`: fasce dopo l'anticipo già al completo, da mostrare barrate nel checkout. */
export interface DisponibilitaServizio { apertura: StatoApertura; fasce: string[]; piene: string[] }
export interface DisponibilitaCasa {
  oggi: string; telefono: string | null; apertiIl: string | null; regole: RegoleFasce; zone: Zona[]
  servizi: Record<Servizio,DisponibilitaServizio>
}
/** Poke composta ordinabile da casa: prezzi impostati e allergeni degli ingredienti confermati. */
export async function leggiPokeDaCasa(db: Db): Promise<{ config: PokeConfig; allergeni: AllergeniVoci } | null> {
  const config = await leggiPokeConfig(db)
  if (!config || !pokeOrdinabile(config)) return null
  const allergeni = await leggiAllergeniPoke(db,config)
  return allergeni.confermati ? { config,allergeni: allergeni.voci } : null
}
/** Ordini attivi da casa per fascia, nel giorno `oggi` di Roma. */
export async function occupazioneFasce(db: Db, oggi: string): Promise<Occupazione[]> {
  const righe = await db.query<{ fascia: Date; totale: number; domicilio: number }>(`select fascia,count(*)::int as totale,count(*) filter (where tipo='domicilio')::int as domicilio
    from ordini where tipo<>'tavolo' and stato=any($1::text[]) and fascia >= $2 and fascia < $3 group by fascia`,[STATI_ATTIVI_CASA,istanteRoma(oggi,0),istanteRoma(oggi,24 * 60)])
  return righe.map(r => ({ fascia: new Date(r.fascia).toISOString(),totale: r.totale,domicilio: r.domicilio }))
}
/** Tutto quello che serve per sapere se e quando si può ordinare adesso. Da usare anche dentro la transazione d'invio. */
export async function leggiDisponibilita(db: Db, adesso: Date, prova: boolean): Promise<DisponibilitaCasa> {
  const oggi = dataRoma(adesso), giorno = giornoSettimana(oggi)
  const [impostazioni,completi,chiuso,zone,occupazione,turniAsporto,turniDomicilio] = [await leggiImpostazioni(db),await allergeniCompleti(db),await chiusoIl(db,oggi),
    await elencoZone(db,true),await occupazioneFasce(db,oggi),await turniDelGiorno(db,'asporto',giorno),await turniDelGiorno(db,'domicilio',giorno)]
  const regole: RegoleFasce = { capacitaFascia: impostazioni.capacitaFascia,capacitaConsegne: impostazioni.capacitaConsegne,anticipoMinuti: impostazioni.anticipoMinuti }
  const turni = { asporto: turniAsporto,domicilio: turniDomicilio }
  const servizi = Object.fromEntries(SERVIZI.map(s => {
    const tutte = fasceDelGiorno(oggi,turni[s])
    const fasce = fascePrenotabili(s,tutte,occupazione,regole,adesso).map(f => f.toISOString())
    const piene = fascePiene(s,tutte,occupazione,regole,adesso).map(f => f.toISOString())
    const apertura = aperturaServizio(s,{ allergeniCompleti: completi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,oggi,chiusoOggi: chiuso,zoneAttive: zone.length,fasceLibere: fasce.length,prova })
    return [s,{ apertura,fasce: apertura.aperto ? fasce : [],piene: apertura.aperto ? piene : [] }]
  })) as Record<Servizio,DisponibilitaServizio>
  return { oggi,telefono: impostazioni.telefono,apertiIl: impostazioni.apertiIl,regole,zone,servizi }
}
