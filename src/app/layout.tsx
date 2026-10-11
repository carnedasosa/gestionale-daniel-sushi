import type { Metadata, Viewport } from 'next'
import '@/styles/ds/cupertino.css'
import '@/styles/ds/tokens.css'
import '@/styles/ds/bundle.css'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export const metadata: Metadata = {
  title: "Daniel's Sushi — Ordini",
  description: "Ordina da Daniel's Sushi, Bitetto: al tavolo, da asporto e a domicilio.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
