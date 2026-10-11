import type { Metadata } from 'next'
import { Bebas_Neue, Caveat, DM_Sans, Jost } from 'next/font/google'
import '@/styles/ds/tokens.css'
import '@/styles/ds/bundle.css'
import './globals.css'

// Font self-hosted da next/font: il browser del cliente non contatta Google.
const display = Bebas_Neue({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--ff-display' })
const label = Jost({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--ff-label' })
const body = DM_Sans({ subsets: ['latin'], axes: ['opsz'], display: 'swap', variable: '--ff-body' })
const script = Caveat({ subsets: ['latin'], weight: '600', display: 'swap', variable: '--ff-script' })

export const metadata: Metadata = {
  title: "Daniel's Sushi — Ordini",
  description: "Ordina da Daniel's Sushi, Bitetto: al tavolo, da asporto e a domicilio.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${display.variable} ${label.variable} ${body.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  )
}
