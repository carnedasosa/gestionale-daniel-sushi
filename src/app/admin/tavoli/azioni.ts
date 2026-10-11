'use server'
import { revalidatePath } from 'next/cache'
import { richiediRuolo } from '@/auth/sessione'
import { db } from '@/server/db'
import { elencoTavoli, creaTavolo, aggiornaTavolo } from '@/tavoli/repo'
import { idValido, nomeValido } from '@/tavoli/validazione'
import { slugLibero } from '@/domain/slug-tavolo'
export interface ValoriTavolo { nome: string; posizione: string; attivo: boolean }
export interface StatoTavolo { errore: string | null; salvato: boolean; valori: ValoriTavolo | null; invii: number }
function valoriForm(fd: FormData): ValoriTavolo { return { nome: typeof fd.get('nome') === 'string' ? fd.get('nome') as string : '', posizione: typeof fd.get('posizione') === 'string' ? fd.get('posizione') as string : '', attivo: fd.get('attivo') === 'on' } }
function errore(stato: StatoTavolo,valori: ValoriTavolo,messaggio: string): StatoTavolo { return { salvato: false,errore: messaggio,valori,invii: stato.invii + 1 } }
function successo(stato: StatoTavolo): StatoTavolo {
  revalidatePath('/admin/tavoli'); revalidatePath('/admin/tavoli/stampa'); revalidatePath('/staff'); revalidatePath('/tavolo/[slug]','page')
  return { salvato: true,errore: null,valori: null,invii: stato.invii + 1 }
}
export async function aggiungiTavolo(stato: StatoTavolo,fd: FormData): Promise<StatoTavolo> {
  await richiediRuolo('admin')
  const valori = valoriForm(fd)
  if (!nomeValido(valori.nome)) return errore(stato,valori,'Inserisci un nome da 1 a 40 caratteri.')
  try {
    for (let i = 0; i < 10; i++) {
      const tavoli = await elencoTavoli(db), slug = slugLibero(valori.nome,tavoli.map(t => t.slug))
      try { await creaTavolo(db,valori.nome.trim(),slug); return successo(stato) }
      catch (err) { if (err && typeof err === 'object' && 'code' in err && err.code === '23505') continue; throw err }
    }
    return errore(stato,valori,'Creazione non riuscita, riprova.')
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return errore(stato,valori,'Salvataggio non riuscito: controlla la connessione e riprova.')
  }
}
export async function salvaTavolo(id: string,stato: StatoTavolo,fd: FormData): Promise<StatoTavolo> {
  await richiediRuolo('admin')
  const valori = valoriForm(fd), posizione = Number(valori.posizione)
  if (!idValido(id) || !nomeValido(valori.nome) || !/^\d+$/.test(valori.posizione) || !Number.isSafeInteger(posizione) || posizione > 2147483647 || (fd.get('attivo') !== null && fd.get('attivo') !== 'on')) return errore(stato,valori,'Controlla nome, posizione e stato del tavolo.')
  try {
    const t = (await elencoTavoli(db)).find(t => t.id === id)
    if (!t) return errore(stato,valori,'Tavolo non trovato.')
    if (!valori.attivo && t.sessione) return errore(stato,valori,'Chiudi prima il tavolo dallo schermo staff')
    const aggiornato = await aggiornaTavolo(db,id,{ nome: valori.nome.trim(),attivo: valori.attivo,posizione })
    if (!aggiornato) return errore(stato,valori,valori.attivo ? 'Tavolo non trovato.' : 'Chiudi prima il tavolo dallo schermo staff')
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'errore sconosciuto')
    return errore(stato,valori,'Salvataggio non riuscito: controlla la connessione e riprova.')
  }
  return successo(stato)
}
