'use client'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { MenuOrdinabile } from '@/ordinare/MenuOrdinabile'
import { inviaOrdineCameriere } from '../../../azioni-cameriere'
/** Menù del cameriere per un tavolo aperto: carrello separato da quelli dei clienti, invio con origine «cameriere». */
export function MenuCameriere({ categorie,config,sessioneId }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string }) {
  return <MenuOrdinabile categorie={categorie} config={config} chiaveStorage={`ds_carrello_cameriere_${sessioneId}`} invia={(righe,chiaveInvio) => inviaOrdineCameriere(sessioneId,righe,chiaveInvio)} etichettaBarra="Rivedi e manda in cucina" />
}
