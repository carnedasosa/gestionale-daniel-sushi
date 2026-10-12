import { randomUUID } from 'node:crypto'
import type { Db } from '@/server/db-tipi'
import { aggiungiOrario, creaZona, impostaApertura, salvaImpostazioni } from '@/casa/impostazioni-repo'
import { creaOrdineCasa, type OrdineCasa } from '@/casa/ordini-casa-repo'
// Lunedì 12/10/2026 alle 18:00 di Roma; prima fascia prenotabile: 18:30 (16:30 UTC).
export const ADESSO = new Date('2026-10-12T16:00:00Z')
export const F1830 = new Date('2026-10-12T16:30:00.000Z')
/** Database con seed pronto per gli ordini da casa: allergeni confermati, ordini aperti, una zona. */
export async function preparaCasa(db: Db) {
  await db.query('update piatti set allergeni_confermati=true')
  await salvaImpostazioni(db,{ capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' })
  await impostaApertura(db,'2026-10-12')
  await aggiungiOrario(db,{ servizio: 'asporto',giorno: 1,dalle: '18:00',alle: '20:00' })
  await aggiungiOrario(db,{ servizio: 'domicilio',giorno: 1,dalle: '18:30',alle: '20:00' })
  const zona = await creaZona(db,{ nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 0 })
  const [piatto] = await db.query<{ id: string }>('select id from piatti where numero=1') // 6,00 €
  return { zona,piatto: piatto.id }
}
/** Un ordine d'asporto di 2 × 6,00 € alle 18:30, a nome di Anna. */
export async function ordineAsporto(db: Db, piatto: string): Promise<OrdineCasa> {
  const e = await creaOrdineCasa(db,{ righe: [{ piattoId: piatto,quantita: 2,nota: '' }],totaleVistoCent: 1200,chiaveInvio: randomUUID(),rete: null,adesso: ADESSO,prova: false,
    dati: { tipo: 'asporto',zonaId: null,indirizzo: null,noteConsegna: null,fascia: F1830,nome: 'Anna',telefono: '3331234567',email: 'anna@esempio.it',pagamento: 'carta',contantiDaCent: null } })
  if (!e.ok) throw new Error(e.errore)
  return e.ordine
}
