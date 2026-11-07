import type { NextConfig } from "next";

// Solo in osservazione (Report-Only): il browser segnala in console ciò che violerebbe la regola ma non blocca nulla,
// quindi non può rompere le foto (/foto/[piatto]/[versione]), i QR in SVG né le pagine di stampa.
// 'unsafe-inline' serve agli script che Next mette nella pagina e agli attributi style di React: senza nonce non si può
// togliere. Il browser parla solo con questo sito (dati dal server, font in casa con next/font, nessun Supabase lato client).
// Anche frame-ancestors qui si limita a segnalare (provato su Chromium): chi blocca l'incorniciamento è X-Frame-Options.
const politicaContenuti = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Solo ciò che l'app non usa: wake lock e audio dello schermo staff restano permessi.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: politicaContenuti },
        ],
      },
    ];
  },
};

export default nextConfig;
