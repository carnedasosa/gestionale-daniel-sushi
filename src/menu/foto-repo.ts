import { createHash } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { dimensioneValida, MAX_BYTE_FOTO, tipoFoto, versioneValida, type InfoFoto, type TipoFoto } from '@/domain/foto'
import { idValido } from '@/tavoli/validazione'

export type EsitoFoto = { ok: true; foto: InfoFoto } | { ok: false; errore: string }
/** Sostituisce la foto del piatto. Il tipo viene dai byte; la versione è l'impronta dei byte (cambia solo se cambia la foto). */
export async function salvaFoto(db: Db, piattoId: string, dati: Uint8Array, larghezza: number, altezza: number): Promise<EsitoFoto> {
  if (!idValido(piattoId)) return { ok: false,errore: 'Piatto non valido.' }
  if (!(dati instanceof Uint8Array) || dati.length < 100 || dati.length > MAX_BYTE_FOTO) return { ok: false,errore: 'La foto deve pesare al massimo 400 KB.' }
  const tipo = tipoFoto(dati)
  if (!tipo) return { ok: false,errore: 'Formato non riconosciuto: usa una foto JPEG, PNG o WebP.' }
  if (!dimensioneValida(larghezza) || !dimensioneValida(altezza)) return { ok: false,errore: 'Dimensioni della foto non valide.' }
  const versione = createHash('sha256').update(dati).digest('hex').slice(0,16)
  const [r] = await db.query<InfoFoto>(`insert into foto_piatti (piatto_id,dati,tipo,larghezza,altezza,versione) select id,$2,$3,$4,$5,$6 from piatti where id=$1
    on conflict (piatto_id) do update set dati=excluded.dati,tipo=excluded.tipo,larghezza=excluded.larghezza,altezza=excluded.altezza,versione=excluded.versione,aggiornata_il=now()
    returning versione,larghezza,altezza`,[piattoId,dati,tipo,larghezza,altezza,versione])
  return r ? { ok: true,foto: r } : { ok: false,errore: 'Piatto non trovato.' }
}
export async function togliFoto(db: Db, piattoId: string): Promise<boolean> {
  if (!idValido(piattoId)) return false
  return (await db.query('delete from foto_piatti where piatto_id=$1 returning piatto_id',[piattoId])).length === 1
}
/** Byte della foto, solo se la versione chiesta è quella attuale (una versione vecchia non resta servibile). */
export async function leggiFoto(db: Db, piattoId: string, versione: string): Promise<{ dati: Uint8Array; tipo: TipoFoto } | null> {
  if (!idValido(piattoId) || !versioneValida(versione)) return null
  return (await db.query<{ dati: Uint8Array; tipo: TipoFoto }>('select dati,tipo from foto_piatti where piatto_id=$1 and versione=$2',[piattoId,versione]))[0] ?? null
}
