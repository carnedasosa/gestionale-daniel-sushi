import type { Metadata } from 'next'
import '@/styles/ds/tokens.css'
import '@/styles/ds/bundle.css'
import './globals.css'

export const metadata: Metadata = {
  title: "Daniel's Sushi — Ordini",
  description: "Ordina da Daniel's Sushi, Bitetto: al tavolo, da asporto e a domicilio.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Jost:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
