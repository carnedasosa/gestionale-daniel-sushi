'use server'

import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { parseEuro } from '@/domain/soldi'
import { leggiPokeConfig, salvaPokeConfig } from '@/tavoli/poke-repo'

export interface ValoriPoke { base: string; extra: string; gruppi: { min: string; max: string; inclusi: string }[] }
export interface StatoPoke { salvato: boolean; errore: string | null; valori: ValoriPoke | null; invii: number }
export async function salvaPoke(stato: StatoPoke, fd: FormData): Promise<StatoPoke> {
  await richiediRuolo('admin')
  const testo = (nome: string) => typeof fd.get(nome) === 'string' ? fd.get(nome) as string : ''
  const valori: ValoriPoke = { base: testo('base'), extra: testo('extra'), gruppi: [] }
  const invii = stato.invii + 1
  const errore = (messaggio: string): StatoPoke => ({ salvato: false, errore: messaggio, valori, invii })
  try {
    const config = await leggiPokeConfig(db)
    if (!config) return errore('Configurazione della poke non trovata.')
    valori.gruppi = config.gruppi.map((_,i) => ({ min: testo(`min_${i}`), max: testo(`max_${i}`), inclusi: testo(`inclusi_${i}`) }))
    const base = parseEuro(valori.base), extra = parseEuro(valori.extra)
    if (base === null || extra === null) return errore('Inserisci un prezzo base e un prezzo extra validi.')
    const gruppi = config.gruppi.map((g,i) => ({ ...g, min: Number(valori.gruppi[i].min), max: Number(valori.gruppi[i].max), inclusi: Number(valori.gruppi[i].inclusi) }))
    for (const [i,g] of gruppi.entries()) {
      if (Object.values(valori.gruppi[i]).some(v => !/^\d+$/.test(v)) || ![g.min,g.max,g.inclusi].every(Number.isSafeInteger) || g.min < 0 || g.min > g.max || g.max > g.voci.length || g.inclusi < 0 || g.inclusi > g.max) return errore(`Controlla minimo, massimo e inclusi in ${g.nome}.`)
    }
    await salvaPokeConfig(db,{ ...config, gruppi, prezzoBaseCent: base, prezzoExtraCent: extra })
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return errore('Salvataggio non riuscito: controlla la connessione e riprova.')
  }
  revalidatePath('/admin/poke')
  revalidatePath('/tavolo/[slug]','page')
  return { salvato: true, errore: null, valori: null, invii }
}
