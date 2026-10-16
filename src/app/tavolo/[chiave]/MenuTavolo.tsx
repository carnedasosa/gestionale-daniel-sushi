'use client'
import type { CategoriaConPiatti } from '@/menu/repo'
import type { PokeConfig } from '@/menu/importa'
import { MenuOrdinabile } from '@/ordinare/MenuOrdinabile'
import { inviaOrdine } from './azioni'
/** Menù del telefono al tavolo: la chiave di storage è quella di sempre, così i carrelli in corso non si perdono. */
export function MenuTavolo({ categorie,config,sessioneId,chiave }: { categorie: CategoriaConPiatti[]; config: PokeConfig | null; sessioneId: string; chiave: string }) {
  return <MenuOrdinabile categorie={categorie} config={config} chiaveStorage={`carrello_${sessioneId}`} invia={(righe,chiaveInvio) => inviaOrdine(chiave,righe,chiaveInvio)} />
}
