'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { salvaImpostazioniCassa } from '@/cassa/impostazioni-repo'
import { validaImpostazioniCassa } from '@/domain/valida-cassa'
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
