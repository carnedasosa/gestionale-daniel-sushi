'use client'
import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfermaAzione } from '@/componenti/ConfermaAzione'
import { dimensioniRidotte, urlFoto, type InfoFoto } from '@/domain/foto'
import { caricaFotoPiatto, rimuoviFotoPiatto } from './azioni-foto'

/** Ridisegna la foto con il lato lungo a 800 px, in WebP (JPEG dove il browser non sa scrivere WebP). */
async function rimpicciolisci(file: File): Promise<{ blob: Blob; larghezza: number; altezza: number }> {
  const bitmap = await createImageBitmap(file)
  const { larghezza,altezza } = dimensioniRidotte(bitmap.width,bitmap.height)
  const tela = document.createElement('canvas')
  tela.width = larghezza; tela.height = altezza
  tela.getContext('2d')!.drawImage(bitmap,0,0,larghezza,altezza)
  bitmap.close()
  const comeBlob = (tipo: string) => new Promise<Blob | null>(ok => tela.toBlob(ok,tipo,0.8))
  const webp = await comeBlob('image/webp')
  const blob = webp?.type === 'image/webp' ? webp : await comeBlob('image/jpeg')
  if (!blob) throw new Error('foto non convertita')
  return { blob,larghezza,altezza }
}

export function FotoPiatto({ id,nome,foto }: { id: string; nome: string; foto: InfoFoto | null }) {
  const [inCorso,startTransition] = useTransition()
  const [errore,setErrore] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const carica = (file: File) => startTransition(async () => {
    setErrore(null)
    try {
      const r = await rimpicciolisci(file)
      const fd = new FormData()
      fd.set('foto',r.blob,'foto'); fd.set('larghezza',String(r.larghezza)); fd.set('altezza',String(r.altezza))
      const e = await caricaFotoPiatto(id,fd)
      if (!e.ok) setErrore(e.errore)
      router.refresh()
    } catch { setErrore('Foto non caricata: prova con un’altra immagine (JPEG o PNG).') }
    finally { if (campo.current) campo.current.value = '' }
  })
  const togli = () => startTransition(async () => {
    try { const e = await rimuoviFotoPiatto(id); if (!e.ok) setErrore(e.errore); router.refresh() }
    catch { setErrore('Operazione non riuscita, riprova.') }
  })
  return <section className="b-card b-foto-piatto" aria-labelledby="titolo-foto">
    <h2 id="titolo-foto" className="b-titolo-3">Foto nel menù</h2>
    {foto ? <Image className="b-foto-piatto__anteprima" src={urlFoto(id,foto.versione)} width={foto.larghezza} height={foto.altezza} alt={`Foto: ${nome}`} unoptimized />
      : <p className="b-secondario">Nessuna foto: nel menù il piatto appare solo con il testo.</p>}
    <label className="b-btn b-btn--secondario b-foto-piatto__scegli" aria-busy={inCorso}>
      {inCorso ? 'Caricamento…' : foto ? 'Cambia foto' : 'Aggiungi foto'}
      <input ref={campo} type="file" accept="image/*" className="b-nascosto" disabled={inCorso} onChange={e => { const f = e.target.files?.[0]; if (f) carica(f) }} />
    </label>
    {foto && <ConfermaAzione stile="discreto" inCorso={inCorso} domanda={`Togliere la foto di ${nome} dal menù?`} conferma={togli}>Togli la foto</ConfermaAzione>}
    {errore && <p role="alert" className="b-errore">{errore}</p>}
    <p className="b-secondario b-piccolo">La foto si rimpicciolisce da sola prima dell’invio. Meglio orizzontale (4:3), con il piatto al centro.</p>
  </section>
}
