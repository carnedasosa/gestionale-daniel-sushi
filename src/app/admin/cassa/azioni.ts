'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { salvaImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { validaImpostazioniCassa, validaImpostazioniFiscali } from '@/domain/valida-cassa'
import { repartiFiscaliCategorie, salvaImpostazioniFiscali } from '@/fiscale/scontrini-repo'
export interface StatoModulo { errore: string | null; salvato: boolean; valori: Record<string,string> | null; invii: number }
function valori(fd: FormData): Record<string,string> {
  return Object.fromEntries([...fd.entries()].filter((e): e is [string,string] => typeof e[1] === 'string' && !e[0].startsWith('$')))
}
export async function salvaCassa(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  const v = valori(fd), invii = stato.invii + 1
  const esito = validaImpostazioniCassa(v)
  if (!esito.ok) return { errore: esito.errore,salvato: false,valori: v,invii }
  try { await salvaImpostazioniCassa(db,esito.dati) } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Salvataggio non riuscito: controlla la connessione e riprova.',salvato: false,valori: v,invii }
  }
  revalidatePath('/admin/cassa'); revalidatePath('/staff')
  return { errore: null,salvato: true,valori: null,invii }
}

/** Registratore telematico: reparti fiscali e scontrino automatico. Le categorie sono quelle del DB, non quelle del modulo. */
export async function salvaFiscale(stato: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediRuolo('admin')
  const v = valori(fd), invii = stato.invii + 1
  try {
    const categorie = (await repartiFiscaliCategorie(db)).map(c => c.id)
    const esito = validaImpostazioniFiscali(v,categorie)
    if (!esito.ok) return { errore: esito.errore,salvato: false,valori: v,invii }
    await salvaImpostazioniFiscali(db,esito.dati.impostazioni,esito.dati.categorie)
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return { errore: 'Salvataggio non riuscito: controlla la connessione e riprova.',salvato: false,valori: v,invii }
  }
  revalidatePath('/admin/cassa'); revalidatePath('/staff','layout')
  return { errore: null,salvato: true,valori: null,invii }
}
