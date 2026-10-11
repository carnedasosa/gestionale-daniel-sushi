import Image from 'next/image'
import '@/styles/menu.css'

export default function LayoutCliente({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="contenitore intestazione">
        <Image src="/logo.png" alt="Daniel's Sushi" width={64} height={64} priority />
        <p className="eyebrow">Via Beato Giacomo 72 · Bitetto</p>
      </header>
      {children}
    </>
  )
}
