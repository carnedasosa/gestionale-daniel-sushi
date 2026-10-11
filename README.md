# Gestionale ordini di Daniel's Sushi

Web app per gestire il menù e gli ordini di Daniel's Sushi (Bitetto), costruita con Next.js, TypeScript e Supabase.

Il lavoro è diviso in tappe:

- **Tappa 1 (questa)**: base del progetto, menù pubblico con allergeni, accesso admin/staff e gestione del menù.
- **Tappe 2-3**: ordini al tavolo e a domicilio.

Documentazione di progetto:

- Specifica: [`docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md`](docs/superpowers/specs/2026-10-11-gestionale-ordini-design.md)
- Piani di lavoro: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Requisiti

- Node 22

## Avvio

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Copia `.env.example` in `.env.local` e compila le variabili:

   | Variabile | Dove trovarla |
   | --- | --- |
   | `SUPABASE_URL` | Supabase → Project Settings → API |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API |
   | `DATABASE_URL` | Supabase → Connect → Transaction pooler (porta 6543), con la password del database |

   Queste variabili sono lette solo dal server e non finiscono mai nel browser. Non committare `.env.local`.

3. Avvia l'app:

   ```bash
   npm run dev
   ```

   Poi apri http://localhost:3000.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm test` | esegue i test |
| `npm run typecheck` | controlla i tipi TypeScript |
| `npm run lint` | esegue ESLint |
| `npm run build` | compila l'app per la produzione |

## Database

- Le migrazioni sono in `supabase/migrations/`.
- Il seed del menù è generato da `data/menu-sito.json` con `npm run seed`, che scrive `supabase/seed.sql`. Il seed è pensato per un database vuoto.

## Utenti

1. Crea l'utente in Supabase → Authentication → Users → Add user (con Auto Confirm).
2. Assegna il ruolo:

   ```bash
   npm run ruolo -- <email> admin|staff
   ```

Le nuove registrazioni sono disattivate in Supabase: solo gli utenti creati a mano possono accedere.

## Pagine

| Percorso | Contenuto |
| --- | --- |
| `/` | menù pubblico |
| `/accesso` | accesso per admin e staff |
| `/admin/menu` | gestione del menù (admin) |
| `/staff` | area staff (segnaposto) |

## Allergeni

Per la vendita a distanza il Reg. UE 1169/2011, art. 14, impone che le informazioni sugli allergeni siano disponibili prima dell'acquisto. Per questo gli ordini da casa non partono finché tutti i piatti non hanno gli allergeni confermati.
