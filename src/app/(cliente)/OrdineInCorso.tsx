'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CHIAVE_ULTIMO_ORDINE, leggiUltimoOrdine, type UltimoOrdine } from '@/ordinare/archivio-casa'
/** Nome accessibile del link: comincia con il testo che si legge, per chi usa il controllo vocale. */
export const etichettaOrdineInCorso = (numero: number) => `Il tuo ordine n. ${numero} · Segui lo stato`
/** Link all'ultimo ordine fatto da questo browser nelle ultime 12 ore. */
export function OrdineInCorso() {
  const [ordine,setOrdine] = useState<UltimoOrdine | null>(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Lettura da localStorage dopo l'hydration.
      setOrdine(leggiUltimoOrdine(localStorage.getItem(CHIAVE_ULTIMO_ORDINE),Date.now()))
    } catch { /* Senza storage niente link. */ }
  },[])
  if (!ordine) return null
  return <Link className="b-in-corso" href={`/ordine/${ordine.token}`} aria-label={etichettaOrdineInCorso(ordine.numero)}>
    <span className="b-in-corso__testo">Il tuo ordine <span className="b-num">n. {ordine.numero}</span></span><span aria-hidden="true">Segui →</span>
  </Link>
}
/** Salva l'ordine come «in corso» in questo browser (anche quando si arriva dal link dell'email). */
export function RicordaOrdine({ token,numero }: { token: string; numero: number }) {
  useEffect(() => {
    try {
      const attuale = leggiUltimoOrdine(localStorage.getItem(CHIAVE_ULTIMO_ORDINE),Date.now())
      // Riscrive anche lo stesso ordine se il numero è cambiato (prima si salvava il numero globale).
      if (attuale?.token !== token || attuale.numero !== numero) localStorage.setItem(CHIAVE_ULTIMO_ORDINE,JSON.stringify({ token,numero,salvatoIl: Date.now() }))
    } catch { /* Facoltativo. */ }
  },[token,numero])
  return null
}
