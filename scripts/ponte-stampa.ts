// Ponte di stampa del locale. Uso (sul PC della cassa, sempre acceso):
//   npx tsx scripts/ponte-stampa.ts ponte-stampa.json
// Il file di configurazione (esempio in scripts/ponte-stampa.esempio.json) dice indirizzo del gestionale e delle
// stampanti; il token può stare nella variabile d'ambiente STAMPA_TOKEN invece che nel file.
import { readFileSync } from 'node:fs'
import { CODE_PONTE, giro, leggiConfigurazione, type CodaPonte, type Configurazione } from './ponte-stampa/trasporto'

/** Una coda per sempre: il registratore può tenere occupato un giro per 30 s, e le comande non devono aspettarlo. */
async function ciclo(c: Configurazione, coda: CodaPonte, pausa: number): Promise<never> {
  let erroriDiFila = 0
  for (;;) {
    try {
      const n = await giro(c,{ coda })
      if (erroriDiFila) console.log(`${coda}: di nuovo collegato al gestionale`)
      erroriDiFila = 0
      if (n) console.log(`${new Date().toLocaleTimeString('it-IT')} · ${coda} · ${n} ${n === 1 ? 'lavoro' : 'lavori'}`)
    } catch (err) {
      // Senza rete si riprova: i lavori restano in coda sul server e la cassa vede l'allarme.
      if (erroriDiFila++ % 30 === 0) console.error(`${new Date().toLocaleTimeString('it-IT')} · ${coda} · ${err instanceof Error ? err.message : err}`)
    }
    await new Promise(r => setTimeout(r,pausa))
  }
}

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Uso: npx tsx scripts/ponte-stampa.ts ponte-stampa.json')
  const c = leggiConfigurazione(readFileSync(file,'utf8'),process.env)
  const pausa = Math.max(1,c.intervalloSecondi ?? 2) * 1000
  console.log(`Ponte di stampa acceso verso ${c.server}${c.prova ? ` (prova: scrivo in ${c.prova})` : ''}`)
  await Promise.all(CODE_PONTE.map(coda => ciclo(c,coda,pausa)))
}
main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
