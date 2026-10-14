import type { Metadata, Viewport } from 'next'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import '@/styles/banco/token.css'
import '@/styles/banco/base.css'
import '@/styles/banco/componenti.css'

// Caratteri ospitati dal nostro dominio: il browser dei clienti non contatta Google.
const testo = Archivo({ subsets: ['latin'],variable: '--b-font-testo',display: 'swap' })
const numeri = JetBrains_Mono({ subsets: ['latin'],weight: ['500','700'],variable: '--b-font-numeri',display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3EFE6' },
    { media: '(prefers-color-scheme: dark)', color: '#141310' },
  ],
}

export const metadata: Metadata = {
  title: "Daniel's Sushi — Ordini",
  description: "Ordina da Daniel's Sushi, Bitetto: al tavolo, da asporto e a domicilio.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${testo.variable} ${numeri.variable}`}>
      <body>{children}</body>
    </html>
  )
}
