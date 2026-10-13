import Image from 'next/image'
import '@/styles/banco/menu.css'
import './casa.css'

export default function LayoutCliente({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="b-contenitore b-testata-cliente">
        <Image src="/logo.png" alt="Daniel's Sushi" width={44} height={44} priority />
        <div className="b-testata-cliente__testi"><span className="b-testata-cliente__nome">Daniel&apos;s Sushi</span><span className="b-secondario b-piccolo">Via Beato Giacomo 72, Bitetto</span></div>
      </header>
      {children}
    </>
  )
}
