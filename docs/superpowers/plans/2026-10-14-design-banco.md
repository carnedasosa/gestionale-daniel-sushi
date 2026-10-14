# Design «Banco» — piano di lavoro

> **Per chi esegue:** l'utente ha scelto l'esecuzione diretta («fai tutto tu»): Claude esegue i task in questa sessione con superpowers:executing-plans. Le caselle (`- [ ]`) tengono il conto.

**Obiettivo:** rifare l'interfaccia di tutta l'app con lo stile «Banco» del canvas approvato, senza cambiare la logica, più le cinque piccole aggiunte della spec (§6).

**Architettura:** CSS puro con token `--b-*` su `:root` e classi `b-*` riutilizzabili; caratteri con `next/font/google`. La logica nuova sta in funzioni pure in `src/domain/` con test propri; i componenti React cambiano solo markup e testi. Si migra un'area alla volta: Cupertino resta caricato finché l'ultima area non è passata a Banco (Task 17).

**Tecnologie:** Next.js 16.4.0 (App Router), React 19.3, TypeScript, vitest 5, Playwright 1.63, PGlite per le prove locali.

**Spec:** [`docs/superpowers/specs/2026-10-14-design-banco-design.md`](../specs/2026-10-14-design-banco-design.md) · Canvas: https://claude.ai/artifact/F4KGcxrn5dCEQmf6ZGigfL

## Vincoli globali

- Nessuna modifica a rotte, azioni del server, migrazioni o regole. Unica modifica ai repository: `aggiornatoIl` in `ordini-casa-repo.ts` (spec §6.2); unica modifica alla disponibilità: `piene` (spec §6.1).
- Testi in italiano, verbi nei bottoni («Inizia a preparare», «Segna servito»…), stato sempre scritto a parole.
- Target ≥ 48 px; bottoni principali dello staff 56 px; «Inizia turno» 72 px.
- Contrasto dei testi ≥ 4,5:1 in chiaro e in scuro (verificato da `src/styles/banco/contrasto.test.ts`).
- Ogni task finisce con `npx vitest run` verde e un commit. A fine lavoro anche `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e`.
- Messaggi di commit in italiano che finiscono con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `AGENTS.md` viene riscritto da `next dev`: non includerlo nei commit se cambia.

## Punti da sorvegliare

1. **Ordine nuovo mentre si guarda un'altra scheda dello staff.** Il suono e la memoria «letto» devono funzionare anche su Tavoli e Conti: lo schermo resta montato, cambia solo cosa si vede (test in Task 10).
2. **Nomi accessibili delle card dello staff.** Gli e2e trovano le card dal titolo «Tavolo prova · n. 4» e «Domicilio 19:30 · n. 9»: il titolo `<h3>` deve continuare a leggersi così anche se diviso in parti grafiche (test in Task 11).
3. **Poke a passi con un gruppo a scelta singola e minimo 0.** Il passo deve poter avanzare senza scelta e «Nessuno» deve restare possibile (test in Task 5).
4. **Orari tutti pieni.** Se non c'è nessun orario libero ma ce ne sono di pieni, il checkout li mostra barrati e dice «Nessun orario libero per oggi» (test in Task 7).
5. **Testo al 200 %.** Barre fisse in basso e griglie dello staff non devono coprire il contenuto: lo spazio sotto è pari all'altezza della barra e le griglie vanno a capo (controllo visivo in Task 18).

---

### Task 1: Fondamenta di Banco

**File:**
- Crea: `src/styles/banco/token.css`, `src/styles/banco/base.css`, `src/styles/banco/componenti.css`, `src/styles/banco/contrasto.test.ts`
- Modifica: `src/app/layout.tsx`

**Interfacce prodotte:** variabili CSS `--b-*` (sotto), classi `b-btn`, `b-btn--principale|secondario|pericolo|discreto|pieno-pericolo|grande`, `b-stato b-stato--<tono>`, `b-card`, `b-lista`, `b-scontrino`, `b-campo`, `b-errore`, `b-scelta`, `b-schede`, `b-scheda`, `b-interruttore`, `b-avviso b-avviso--<tono>`, `b-num`, `b-pannello`, `b-badge`, `b-nascosto`; variabili dei caratteri `--b-font-testo`, `--b-font-numeri`.

- [ ] **Passo 1: test del contrasto (fallisce: il file dei token non c'è)**

```ts
// src/styles/banco/contrasto.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
const css = readFileSync(join(__dirname,'token.css'),'utf8')
const [chiaro,scuro] = css.split('@media (prefers-color-scheme: dark)')
const leggi = (blocco: string) => Object.fromEntries([...blocco.matchAll(/--b-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1],m[2]]))
const luminanza = (hex: string) => {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i + 2),16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}
const rapporto = (a: string, b: string) => { const [x,y] = [luminanza(a),luminanza(b)].sort((p,q) => q - p); return (x + .05) / (y + .05) }
const COPPIE: [string,string][] = [
  ['inchiostro','carta'],['inchiostro','foglio'],['inchiostro','campo'],['grafite','carta'],['grafite','foglio'],['su-inchiostro','inchiostro'],
  ...['accettare','preparare','preparazione','pronto','ritardo'].map(t => [`st-${t}-testo`,`st-${t}-sfondo`] as [string,string]),
  ['su-pieno','pericolo-pieno'],['su-pieno','accettare-pieno'],['pericolo-testo','foglio'],['pericolo-testo','carta'],
]
for (const [nome,blocco] of [['chiaro',chiaro],['scuro',scuro]] as const) {
  it(`contrasto dei testi ≥ 4,5:1 (${nome})`, () => {
    const t = { ...leggi(chiaro),...leggi(blocco) }
    for (const [testo,sfondo] of COPPIE) {
      expect(t[testo],`--b-${testo}`).toBeDefined(); expect(t[sfondo],`--b-${sfondo}`).toBeDefined()
      expect(rapporto(t[testo],t[sfondo]),`${testo} su ${sfondo}`).toBeGreaterThanOrEqual(4.5)
    }
  })
}
```

- [ ] **Passo 2:** `npx vitest run src/styles/banco/contrasto.test.ts` → FALLISCE (ENOENT su `token.css`).

- [ ] **Passo 3: token** — `src/styles/banco/token.css` con i valori della spec §4.1 più:
  `--b-pericolo-testo` (chiaro `#A61E15`, scuro `#F5A9A3`), `--b-pericolo-pieno` (chiaro `#B42318`, scuro `#F07068`), `--b-accettare-pieno` (chiaro `#B4440A`, scuro `#F59A5C`), `--b-su-pieno` (chiaro `#FFFFFF`, scuro `#141310`), `--b-nota-sfondo`/`--b-nota-testo` (chiaro `#FFF1C9`/`#5C4300`, scuro `#3A2F0A`/`#F5DC8A`), `--b-barra` (chiaro `#1C1B18`, scuro `#0B0A08`) e `--b-su-barra` (`#F3EFE6` in entrambi), misure (`--b-r-campo: 10px; --b-r-btn: 12px; --b-r-card: 16px; --b-r-pannello: 24px; --b-tap: 48px; --b-tap-staff: 56px`), durate (`--b-veloce: 120ms; --b-base: 180ms`). Blocco scuro: `@media (prefers-color-scheme: dark) { :root { … } }`. Stampa: `@media print { :root { …valori chiari… } }` messo **prima** del blocco scuro, perché il test separa sul primo `@media (prefers-color-scheme: dark)`. Se un rapporto è sotto 4,5 si scurisce (chiaro) o si schiarisce (scuro) il testo finché il test passa, e si aggiorna la tabella della spec.

- [ ] **Passo 4:** `npx vitest run src/styles/banco/contrasto.test.ts` → PASSA.

- [ ] **Passo 5: base e componenti**
  - `base.css`: `box-sizing`, `body { background: var(--b-carta); color: var(--b-inchiostro); font: 400 1.0625rem/1.45 var(--b-font-testo); }`, focus visibile (`outline: 3px solid var(--b-st-preparazione-punto); outline-offset: 2px`), `.b-num { font-family: var(--b-font-numeri); font-variant-numeric: tabular-nums; }`, `.b-nascosto` (come `.visually-hidden`), `prefers-reduced-motion`, `prefers-contrast: more` (bordi 2px), `overflow-wrap: anywhere` sui testi.
  - `componenti.css`: le classi elencate sopra, con misure e colori del Main del canvas (bottone principale pieno inchiostro con testo `--b-su-inchiostro`; secondario contorno 1,5px inchiostro; pericolo contorno `--b-pericolo-pieno` e testo `--b-pericolo-testo`; `--pieno-pericolo` fondo `--b-pericolo-pieno` e testo `--b-su-pieno`; discreto senza fondo, sottolineato; `aria-busy` con la rotella di oggi; `:disabled` opacità 0,55). `b-pannello` è il `<dialog>`: sotto i 640 px aderisce al fondo con raggio solo in alto e `padding-bottom: max(24px, env(safe-area-inset-bottom))`; sopra è centrato, largo `min(640px, 100% - 32px)`. `b-interruttore` disegna l'interruttore con `::before` su un `button[role=switch]`, `aria-checked` lo sposta e lo colora di verde.

- [ ] **Passo 6: caratteri e caricamento** — in `src/app/layout.tsx`:

```tsx
import { Archivo, JetBrains_Mono } from 'next/font/google'
import '@/styles/banco/token.css'
import '@/styles/banco/base.css'
import '@/styles/banco/componenti.css'
const testo = Archivo({ subsets: ['latin'],variable: '--b-font-testo',display: 'swap' })
const numeri = JetBrains_Mono({ subsets: ['latin'],weight: ['500','700'],variable: '--b-font-numeri',display: 'swap' })
// <html lang="it" className={`${testo.variable} ${numeri.variable}`}>
```
  Gli import Cupertino restano (servono alle aree non ancora migrate). `themeColor` diventa `#F3EFE6` (chiaro) e `#141310` (scuro).

- [ ] **Passo 7:** `npx vitest run` e `npm run typecheck` verdi; `npm run build` compila (scarica i caratteri). Commit «Banco: token, caratteri e pezzi di base».

### Task 2: Funzioni pure delle aggiunte e dei toni

**File:**
- Crea: `src/domain/toni-stato.ts`, `src/domain/toni-stato.test.ts`
- Modifica: `src/domain/poke.ts` (+test), `src/domain/fasce.ts` (+test), `src/domain/stati-casa.ts` (+test), `src/domain/stati-tavolo.ts` (+test), `src/domain/apertura-casa.ts` (+test), `src/casa/disponibilita.ts`, `src/casa/ordini-casa-repo.ts`

**Interfacce prodotte:**
- `type Tono = 'accettare' | 'preparare' | 'preparazione' | 'pronto' | 'ritardo'`; `tonoStato(stato: StatoOrdineTavolo | StatoCasa): Tono`
- `controllaGruppo(g: GruppoPoke, scelte: readonly string[] | undefined): string | null`
- `fascePiene(servizio: Servizio, fasce: Date[], occupazione: Occupazione[], regole: RegoleFasce, adesso: Date): Date[]`
- `DisponibilitaServizio` = `{ apertura; fasce: string[]; piene: string[] }`
- `type Avanzamento = 'fatto' | 'attuale' | 'da_fare'`; `interface Passo { stato: StatoCasa; etichetta: string; avanzamento: Avanzamento }`; `passiOrdine(tipo: Servizio, stato: StatoCasa): Passo[]`
- `riassuntoTavolo(ordini: readonly { sessioneId: string; stato: string }[], sessioneId: string): { inCucina: number }`
- `interface Requisito { chiave: 'telefono' | 'allergeni' | 'poke' | 'zone'; ok: boolean; blocca: boolean; testo: string; link: { href: string; testo: string } | null }`; `requisitiCasa(d: { telefono: string | null; allergeniCompleti: boolean; pokeConfermati: boolean | null; zoneAttive: number }): Requisito[]`
- `OrdineCasa.aggiornatoIl: Date`, `OrdineCasaClient.aggiornatoIl: string`

- [ ] **Passo 1: test che falliscono** (aggiunti ai file di test esistenti o nuovi):

```ts
// src/domain/toni-stato.test.ts
import { expect, it } from 'vitest'
import { tonoStato } from './toni-stato'
it('ogni stato ha il suo tono', () => {
  expect(['in_attesa','inviato','accettato','in_preparazione','pronto','in_consegna','servito','completato','rifiutato','annullato'].map(s => tonoStato(s as never)))
    .toEqual(['accettare','preparare','preparare','preparazione','pronto','pronto','pronto','pronto','ritardo','ritardo'])
})
```
```ts
// in src/domain/poke.test.ts
import { controllaGruppo } from './poke'
it('controllaGruppo: minimo, massimo e gruppo facoltativo vuoto', () => {
  const g = { nome: 'Proteine',voci: ['A','B','C'],min: 1,max: 2,inclusi: 1 }
  expect(controllaGruppo(g,[])).toBe('Scegli almeno 1 in Proteine')
  expect(controllaGruppo(g,undefined)).toBe('Scegli almeno 1 in Proteine')
  expect(controllaGruppo(g,['A','B','C'])).toBe('Al massimo 2 in Proteine')
  expect(controllaGruppo(g,['A'])).toBeNull()
  expect(controllaGruppo({ ...g,min: 0,max: 1 },[])).toBeNull()
})
```
```ts
// in src/domain/fasce.test.ts
import { fascePiene } from './fasce'
it('fascePiene: solo le fasce dopo l’anticipo scartate per capacità', () => {
  const adesso = new Date('2026-10-14T17:00:00.000Z'), regole = { capacitaFascia: 2,capacitaConsegne: 1,anticipoMinuti: 30 }
  const f = ['17:15','17:30','17:45','18:00'].map(o => new Date(`2026-10-14T${o}:00.000Z`))
  const occ = [{ fascia: '2026-10-14T17:15:00.000Z',totale: 2,domicilio: 0 },{ fascia: '2026-10-14T17:30:00.000Z',totale: 2,domicilio: 1 },{ fascia: '2026-10-14T17:45:00.000Z',totale: 1,domicilio: 1 }]
  expect(fascePiene('asporto',f,occ,regole,adesso).map(d => d.toISOString())).toEqual(['2026-10-14T17:30:00.000Z'])
  expect(fascePiene('domicilio',f,occ,regole,adesso).map(d => d.toISOString())).toEqual(['2026-10-14T17:30:00.000Z','2026-10-14T17:45:00.000Z'])
})
```
```ts
// in src/domain/stati-casa.test.ts
import { passiOrdine } from './stati-casa'
it('passiOrdine: flusso del domicilio e dell’asporto, nessun passo per rifiutato o annullato', () => {
  expect(passiOrdine('domicilio','in_preparazione').map(p => `${p.etichetta}:${p.avanzamento}`)).toEqual([
    'Ordine ricevuto:fatto','Confermato dal locale:fatto','In preparazione:attuale','Pronto, sta per partire:da_fare','In consegna:da_fare','Consegnato:da_fare'])
  expect(passiOrdine('asporto','completato').map(p => p.etichetta)).toEqual(['Ordine ricevuto','Confermato dal locale','In preparazione','Pronto per il ritiro','Ritirato'])
  expect(passiOrdine('asporto','completato').at(-1)!.avanzamento).toBe('attuale')
  expect(passiOrdine('asporto','in_attesa')[0].avanzamento).toBe('attuale')
  expect(passiOrdine('domicilio','rifiutato')).toEqual([]); expect(passiOrdine('asporto','annullato')).toEqual([])
})
```
```ts
// in src/domain/stati-tavolo.test.ts
import { riassuntoTavolo } from './stati-tavolo'
it('riassuntoTavolo conta solo gli ordini in cucina della sessione', () => {
  const o = [{ sessioneId: 'a',stato: 'inviato' },{ sessioneId: 'a',stato: 'in_preparazione' },{ sessioneId: 'a',stato: 'servito' },{ sessioneId: 'b',stato: 'inviato' }]
  expect(riassuntoTavolo(o,'a')).toEqual({ inCucina: 2 }); expect(riassuntoTavolo(o,'c')).toEqual({ inCucina: 0 })
})
```
```ts
// in src/domain/apertura-casa.test.ts
import { requisitiCasa } from './apertura-casa'
it('requisitiCasa: quattro voci, solo telefono e allergeni bloccano tutto', () => {
  const r = requisitiCasa({ telefono: null,allergeniCompleti: false,pokeConfermati: false,zoneAttive: 0 })
  expect(r.map(v => [v.chiave,v.ok,v.blocca])).toEqual([['telefono',false,true],['allergeni',false,true],['poke',false,false],['zone',false,false]])
  expect(r.find(v => v.chiave === 'allergeni')!.link).toEqual({ href: '/admin/menu?filtro=allergeni',testo: 'Conferma nel menù' })
  const ok = requisitiCasa({ telefono: '080 123',allergeniCompleti: true,pokeConfermati: null,zoneAttive: 2 })
  expect(ok.map(v => v.chiave)).toEqual(['telefono','allergeni','zone']); expect(ok.every(v => v.ok && v.link === null)).toBe(true)
})
```

- [ ] **Passo 2:** `npx vitest run src/domain` → FALLISCONO (funzioni assenti).

- [ ] **Passo 3: implementazione**

```ts
// src/domain/toni-stato.ts
import type { StatoOrdineTavolo } from './stati-tavolo'
import type { StatoCasa } from './stati-casa'
export type Tono = 'accettare' | 'preparare' | 'preparazione' | 'pronto' | 'ritardo'
/** Colore di uno stato d'ordine (tavolo o casa): lo stesso in tutta l'app. */
export function tonoStato(stato: StatoOrdineTavolo | StatoCasa): Tono {
  switch (stato) {
    case 'in_attesa': return 'accettare'
    case 'inviato': case 'accettato': return 'preparare'
    case 'in_preparazione': return 'preparazione'
    case 'pronto': case 'in_consegna': case 'servito': case 'completato': return 'pronto'
    case 'rifiutato': case 'annullato': return 'ritardo'
  }
}
```
```ts
// in src/domain/poke.ts (stessi messaggi di validaPoke)
import type { GruppoPoke, PokeConfig } from '@/menu/importa'
/** Errore del singolo gruppo, per non far avanzare il passo; null se il gruppo va bene. */
export function controllaGruppo(g: GruppoPoke, scelte: readonly string[] | undefined): string | null {
  const n = scelte?.length ?? 0
  if (n < g.min) return `Scegli almeno ${g.min} in ${g.nome}`
  if (n > g.max) return `Al massimo ${g.max} in ${g.nome}`
  return null
}
```
```ts
// in src/domain/fasce.ts
/** Fasce dopo l'anticipo minimo che non si possono prenotare perché già piene (da mostrare barrate). */
export function fascePiene(servizio: Servizio, fasce: Date[], occupazione: Occupazione[], regole: RegoleFasce, adesso: Date): Date[] {
  const vuota = { totale: 0,domicilio: 0 }
  const perFascia = new Map(occupazione.map(o => [new Date(o.fascia).getTime(),o]))
  const limite = adesso.getTime() + regole.anticipoMinuti * 60000
  return fasce.filter(f => f.getTime() >= limite && !fasciaPrenotabile(servizio,f,perFascia.get(f.getTime()) ?? vuota,regole,adesso))
}
```
```ts
// in src/casa/disponibilita.ts: DisponibilitaServizio { apertura: StatoApertura; fasce: string[]; piene: string[] }
// nel map dei servizi:
const tutte = fasceDelGiorno(oggi,turni[s])
const fasce = fascePrenotabili(s,tutte,occupazione,regole,adesso).map(f => f.toISOString())
const piene = fascePiene(s,tutte,occupazione,regole,adesso).map(f => f.toISOString())
// …apertura come oggi…
return [s,{ apertura,fasce: apertura.aperto ? fasce : [],piene: apertura.aperto ? piene : [] }]
```
```ts
// in src/domain/stati-casa.ts
export type Avanzamento = 'fatto' | 'attuale' | 'da_fare'
export interface Passo { stato: StatoCasa; etichetta: string; avanzamento: Avanzamento }
const FLUSSO: Record<Servizio,StatoCasa[]> = {
  domicilio: ['in_attesa','accettato','in_preparazione','pronto','in_consegna','completato'],
  asporto: ['in_attesa','accettato','in_preparazione','pronto','completato'],
}
const ETICHETTA_PASSO: Partial<Record<StatoCasa,string>> = { in_attesa: 'Ordine ricevuto',accettato: 'Confermato dal locale',in_preparazione: 'In preparazione',in_consegna: 'In consegna' }
/** Passi della cronologia per il cliente; vuota se l'ordine è rifiutato o annullato. */
export function passiOrdine(tipo: Servizio, stato: StatoCasa): Passo[] {
  const flusso = FLUSSO[tipo], i = flusso.indexOf(stato)
  if (i < 0) return []
  return flusso.map((s,j) => ({ stato: s,etichetta: ETICHETTA_PASSO[s] ?? etichettaClienteCasa(tipo,s),avanzamento: j < i ? 'fatto' : j === i ? 'attuale' : 'da_fare' }))
}
```
```ts
// in src/domain/stati-tavolo.ts
/** Ordini ancora in cucina di una sessione, dagli ordini attivi già letti dallo schermo staff. */
export function riassuntoTavolo(ordini: readonly { sessioneId: string; stato: string }[], sessioneId: string): { inCucina: number } {
  return { inCucina: ordini.filter(o => o.sessioneId === sessioneId && (o.stato === 'inviato' || o.stato === 'in_preparazione')).length }
}
```
```ts
// in src/domain/apertura-casa.ts
export interface Requisito { chiave: 'telefono' | 'allergeni' | 'poke' | 'zone'; ok: boolean; blocca: boolean; testo: string; link: { href: string; testo: string } | null }
/** Cosa manca per aprire gli ordini da casa; mostra i controlli di aperturaServizio, non li sostituisce. */
export function requisitiCasa(d: { telefono: string | null; allergeniCompleti: boolean; pokeConfermati: boolean | null; zoneAttive: number }): Requisito[] {
  const voci: Requisito[] = [
    d.telefono ? { chiave: 'telefono',ok: true,blocca: true,testo: 'Telefono del locale impostato',link: null }
      : { chiave: 'telefono',ok: false,blocca: true,testo: 'Manca il telefono del locale: senza, gli ordini online non si aprono',link: { href: '#impostazioni',testo: 'Imposta il telefono' } },
    d.allergeniCompleti ? { chiave: 'allergeni',ok: true,blocca: true,testo: 'Allergeni del menù confermati',link: null }
      : { chiave: 'allergeni',ok: false,blocca: true,testo: 'Ci sono piatti disponibili con allergeni da confermare',link: { href: '/admin/menu?filtro=allergeni',testo: 'Conferma nel menù' } },
  ]
  if (d.pokeConfermati !== null) voci.push(d.pokeConfermati ? { chiave: 'poke',ok: true,blocca: false,testo: 'Allergeni degli ingredienti della poke confermati',link: null }
    : { chiave: 'poke',ok: false,blocca: false,testo: 'La poke composta resta chiusa da casa finché non confermi gli allergeni degli ingredienti',link: { href: '/admin/poke',testo: 'Vai alla poke' } })
  voci.push(d.zoneAttive > 0 ? { chiave: 'zone',ok: true,blocca: false,testo: 'Almeno una zona di consegna attiva',link: null }
    : { chiave: 'zone',ok: false,blocca: false,testo: 'Nessuna zona attiva: il domicilio resta chiuso, l’asporto no',link: { href: '#zone',testo: 'Aggiungi una zona' } })
  return voci
}
```
```ts
// in src/casa/ordini-casa-repo.ts
// OrdineCasa: aggiungere `aggiornatoIl: Date`; COLONNE: aggiungere `o.aggiornato_il as "aggiornatoIl"` dopo creato_il
export type OrdineCasaClient = Omit<OrdineCasa,'fascia' | 'creatoIl' | 'aggiornatoIl'> & { fascia: string; creatoIl: string; aggiornatoIl: string }
export function perClient(o: OrdineCasa): OrdineCasaClient { return { ...o,fascia: o.fascia.toISOString(),creatoIl: new Date(o.creatoIl).toISOString(),aggiornatoIl: new Date(o.aggiornatoIl).toISOString() } }
```
  I fixture dei test che costruiscono `OrdineCasa`/`OrdineCasaClient` aggiungono `aggiornatoIl` (li trova `npm run typecheck`); il mock di `page.test.tsx` per `leggiDisponibilita` non cambia (non legge `piene`).

- [ ] **Passo 4:** `npx vitest run` e `npm run typecheck` verdi. Commit «Funzioni pure per toni, poke a passi, orari pieni, cronologia, riassunto tavolo e requisiti».

### Task 3: Pezzi condivisi

**File:** crea `src/componenti/EtichettaStato.tsx`, `src/componenti/AltreAzioni.tsx`, `src/componenti/componenti.test.tsx`; modifica `src/componenti/Pannello.tsx`, `ConfermaAzione.tsx`, `DettaglioRighe.tsx`, `AggiornamentoAutomatico.tsx`, `RiprovaAutomatico.tsx`.

**Interfacce prodotte:**
- `EtichettaStato({ stato, testo }: { stato: StatoOrdineTavolo | StatoCasa; testo: string })` → `<span className={`b-stato b-stato--${tonoStato(stato)}`}><span className="b-stato__punto" aria-hidden="true" />{testo}</span>`
- `AltreAzioni({ titolo, children }: { titolo: string; children: React.ReactNode })`: bottone `b-btn b-btn--discreto` «Altre azioni» + `Pannello` con titolo `titolo`; i figli sono bottoni impilati.
- `ConfermaAzione` aggiunge `stile?: 'secondario' | 'pericolo' | 'discreto'` (default `'pericolo'`) per il bottone che apre la conferma; il bottone di conferma resta `b-btn--pieno-pericolo` con lo stesso testo dei `children`; il titolo del pannello resta «Conferma».
- `Pannello`: stessa interfaccia; classe `b-pannello`, testata `b-pannello__testa`, «Chiudi» `b-btn b-btn--secondario` tondo da 48 px con `aria-label="Chiudi"`.
- `DettaglioRighe`: stessa interfaccia; righe come `<li className="b-riga">` con quantità in `<strong className="b-num">`, nome, `<s>` per le annullate seguito da « · annullato», nota in `<p className="b-nota">Nota: …</p>`, poke in `<p className="b-riga__poke">` con «Gruppo: voci».

- [ ] **Passo 1: test di rendering (falliscono)**

```tsx
// src/componenti/componenti.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { EtichettaStato } from './EtichettaStato'
import { DettaglioRighe } from './DettaglioRighe'
it('etichetta di stato: tono e testo', () => {
  const html = renderToStaticMarkup(<EtichettaStato stato="in_preparazione" testo="In preparazione" />)
  expect(html).toContain('b-stato--preparazione'); expect(html).toContain('In preparazione')
})
it('righe: nota, poke e riga annullata barrata', () => {
  const html = renderToStaticMarkup(<DettaglioRighe area="staff" righe={[
    { id: 'a',numero: 1,nome: 'Salmone',prezzoUnitCent: 600,quantita: 2,nota: 'senza sesamo',poke: null,annullata: false },
    { id: 'b',numero: null,nome: 'Poke composta',prezzoUnitCent: 900,quantita: 1,nota: null,poke: { Base: ['Riso'],Topping: [] },annullata: false },
    { id: 'c',numero: 2,nome: 'Tonno',prezzoUnitCent: 700,quantita: 1,nota: null,poke: null,annullata: true }]} />)
  expect(html).toContain('Nota: senza sesamo'); expect(html).toContain('Base:'); expect(html).not.toContain('Topping'); expect(html).toContain('<s>'); expect(html).toContain('annullato')
})
```

- [ ] **Passo 2:** il test fallisce (manca `EtichettaStato`). **Passo 3:** implementare i componenti come sopra; `AggiornamentoAutomatico` e `RiprovaAutomatico` usano `b-avviso b-avviso--accettare` e `b-btn b-btn--principale`, testi invariati. **Passo 4:** `npx vitest run` verde (i test esistenti che cercano `staff-nota`/`tavolo-nota` si aggiornano a `b-nota`, stessa verifica). Commit «Pezzi condivisi in stile Banco».

### Task 4: Menù dei clienti (casa e consultazione)

**File:** modifica `src/ordinare/CardPiatto.tsx`, `src/ordinare/SezioniMenu.tsx`, `src/menu/componenti/MenuCliente.tsx` (+test), `src/app/(cliente)/layout.tsx`, `src/app/(cliente)/page.tsx`, `src/app/(cliente)/MenuCasa.tsx`, `src/app/(cliente)/OrdineInCorso.tsx`; crea `src/styles/banco/menu.css` (sostituisce `src/styles/menu.css` per le aree migrate) e riscrive `src/app/(cliente)/casa.css`.

Riferimento: tavola `Casa-Menu`.
- Testata cliente (`layout.tsx`): logo 44 px su fondo foglio, «Daniel's Sushi» e «Via Beato Giacomo 72, Bitetto».
- `OrdineInCorso`: striscia scura `<a>` con «Il tuo ordine n. 18» e «Segui →» (nome accessibile: «Hai un ordine in corso (n. 18): guarda lo stato», `aria-label`).
- Riquadro orari (solo in `page.tsx` quando aperto): punto verde, «Ordini aperti stasera», «Ritiro dalle HH:MM · consegna dalle HH:MM» dalla prima fascia libera di ciascun servizio (`d.servizi[s].fasce[0]`, ora con `oraRoma`); se un servizio è chiuso si scrive solo l'altro. Chiuso: `b-avviso--accettare` con `TESTO_MOTIVO` e «Il menù resta consultabile.».
- `SezioniMenu`/`MenuCliente`: pillole categorie (`b-pillole`, scorrono in orizzontale con `overflow-x: auto`), sezione con `<h2>` e pezzi in `b-num`, lista `b-lista` di `CardPiatto`.
- `CardPiatto` (`article.b-piatto`): numero `b-num`, `<h3>` nome, descrizione, etichette (`b-etichetta` «Della casa», «Piccante» tono accettare, «Vegetariano» tono pronto), allergeni (`testoAllergeni`), prezzo `b-num`; disponibile: bottone tondo «+» con `aria-label="Aggiungi <nome>"` oppure gruppo «−/n/+» con `aria-label` «Riduci/Aumenta <nome>» (come oggi, `quantita >= 20` disabilita +); esaurito: nome barrato, «Esaurito stasera», nessun bottone.
- Card poke (`MenuCasa`, `MenuOrdinabile`): `<button className="b-poke-card">` con «Componi la tua poke», «5 passi · scegli tu gli ingredienti» e «→»; il testo del bottone resta «Componi la tua poke» (nome accessibile usato dall'e2e).

- [ ] **Passo 1:** aggiornare `MenuCliente.test.tsx` e `tavolo/[chiave]/componenti.test.tsx` (test del piatto esaurito) ai nuovi testi: «Esaurito stasera», «Allergeni: Pesce», nessun «Aggiungi»; aggiungere in `MenuCliente.test.tsx` che le categorie hanno `href="#<id>"` e il prezzo `b-num`. Eseguire: falliscono sui testi nuovi.
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde; controllo visivo di `/` a 390 px (Task 18 elenca come avviare il DB locale). Commit «Menù dei clienti in stile Banco».

### Task 5: Poke a passi

**File:** modifica `src/ordinare/ComponiPoke.tsx`; test in `src/app/tavolo/[chiave]/componenti.test.tsx`.

**Consuma:** `controllaGruppo`, `validaPoke`, `allergeniScelte`, `etichettaAllergene`.

Riferimento: tavola `Casa-Poke`. Stato: `scelte` e `passo` (indice del gruppo). Mostra: barra dei passi (`config.gruppi.length` segmenti, fatti pieni), «Passo i di n», riepilogo dei gruppi precedenti («Base: Riso bianco» + bottone «Cambia» che torna a quel passo), titolo del gruppo, istruzione («Scegline 1», oppure «Scegline fino a max. Le prime inclusi sono incluse, le altre si pagano a parte.»; con `min > 0` e `max > 1`: «Scegline da min a max…»), contatore «n di max scelte», riquadri `b-scelta` (radio se `max === 1`, checkbox altrimenti; `name="poke-<gruppo>"`), «Nessuno» se `max === 1 && min === 0`, allergeni (`aria-live`, testi di oggi), prezzo stimato, errore del gruppo (`role="status"`), bottone principale «Avanti: <prossimo gruppo>» (disabilitato se `controllaGruppo` dà errore) o, all'ultimo passo, «Aggiungi al carrello» (disabilitato se `validaPoke` non è ok). Il pannello che lo contiene mantiene il titolo «Componi poke».

- [ ] **Passo 1: test (falliscono)**

```tsx
it('poke a passi: un gruppo alla volta, avanti bloccato finché il gruppo non va, «Nessuno» per i facoltativi', () => {
  const config = { titolo: 'Poke',gruppi: [{ nome: 'Base',voci: ['Riso'],min: 1,max: 1,inclusi: 1 },{ nome: 'Salse',voci: ['Soia'],min: 0,max: 1,inclusi: 1 }],prezzoBaseCent: 900,prezzoExtraCent: 100 }
  const html = renderToStaticMarkup(<ComponiPoke config={config} aggiungi={() => {}} />)
  expect(html).toContain('Passo 1 di 2'); expect(html).toContain('Riso'); expect(html).not.toContain('Soia')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Avanti: Salse/)
  expect(html).not.toContain('Aggiungi al carrello')
})
```
  I due test esistenti del composer (allergeni / rimando al personale) restano invariati.
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Poke da comporre a passi».

### Task 6: Carrello

**File:** modifica `src/ordinare/Carrello.tsx`, `src/app/(cliente)/MenuCasa.tsx`, `src/app/tavolo/[chiave]/MenuOrdinabile.tsx`; test in `tavolo/[chiave]/componenti.test.tsx`.

Riferimento: tavola `Casa-Carrello`.
- Barra fissa (`b-barra-basso`): bottone principale con badge quantità, testo e totale. Nome accessibile: `Carrello · ${quantita} piatti · ${totale}` (`aria-label`, così e2e e lettori di schermo restano chiari); testo visibile «Vedi il carrello» (casa) o «Rivedi e manda in cucina» (tavolo) tramite nuova prop `etichettaBarra`.
- Pannello «Il tuo carrello»: righe con nome e importo (`b-num`), «−/n/+» (aria-label invariati), «Rimuovi» (tono pericolo, discreto), «Nota per la cucina» che mostra la `textarea` al tocco (aperta da subito se la nota c'è già); etichetta del campo «Nota per la cucina, es. senza sesamo». Totale stimato e «Il prezzo finale viene ricontrollato quando confermi.». Bottone principale `azione` («Invia ordine» resta per il tavolo, «Vai al riepilogo» per casa).
- `MenuCasa` passa `etichettaBarra="Vedi il carrello"`; `MenuOrdinabile` `etichettaBarra="Rivedi e manda in cucina"`; messaggio «Ordine n. X inviato in cucina» in `b-avviso--pronto` con «Fine».

- [ ] **Passo 1:** test esistenti del carrello invariati («Vai al riepilogo», «Poke composta · —», «senza le poke da ricomporre»): il titolo della riga resta `nome · importo`. Aggiungere: la barra ha `aria-label="Carrello · 0 piatti · 0,00 €"` e testo «Vedi il carrello». **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Carrello in stile Banco».

### Task 7: Riepilogo e conferma con orari pieni

**File:** modifica `src/app/(cliente)/ordina/Checkout.tsx`, `src/app/(cliente)/ordina/page.tsx`; test in `src/app/(cliente)/componenti.test.tsx`.

**Consuma:** `DisponibilitaServizio.piene`. `ServizioCheckout` diventa `{ aperto: boolean; motivo: string | null; fasce: string[]; piene: string[] }`; la pagina passa `piene: d.servizi[s].piene`. Le nuove fasce restituite da un invio fallito (`esito.fasce`) sostituiscono le libere; le piene restano quelle ricevute.

Riferimento: tavola `Casa-Checkout`. «← Menù», titolo «Quasi fatto» e sottotitolo; cinque `fieldset` numerati con `legend`:
1. «Come lo ricevi?» — riquadri «Ritiro al locale» (sotto: «Via Beato Giacomo 72») e «A domicilio» (sotto: «Paghi alla consegna»); servizio chiuso: riquadro disabilitato con il motivo. Le etichette accessibili restano «Ritiro al locale (asporto)» e «Consegna a domicilio» (`aria-label` sull'input) per non rompere e2e e lettori di schermo.
2. «Dove lo portiamo?» (solo domicilio) — Zona (`select`, testi delle opzioni invariati), «Indirizzo e numero civico», «Citofono, piano, note per il fattorino (facoltativo)».
3. «A che ora, circa?» — gruppo di radio a bottone (`b-orari`, griglia 4 colonne), ordinati per orario: libere selezionabili, piene `disabled` con `<s>` e « pieno» in `b-nascosto`; nessuna libera: «Nessun orario libero per oggi.». Il gruppo ha `aria-label` «Consegna verso le» / «Ritiro alle».
4. «Chi sei?» — Nome, Telefono, «Email (per la conferma)».
5. «Come paghi alla consegna/al ritiro?» — riquadri «Contanti» e «Carta (POS)», «Paghi con (facoltativo, per il resto)».
Poi lo scontrino «Il tuo ordine» (righe, consegna, totale, «Modifica il carrello» → `/`), avvisi di oggi (non disponibili, minimo, poke da ricomporre), privacy, errore generale e barra fissa con il bottone «Conferma l'ordine · totale» (testo e `disabled` come oggi).

- [ ] **Passo 1: test (falliscono)** — aggiornare il test del checkout: le fasce non sono più `<option>`:

```tsx
it('checkout: orari liberi e pieni in ordine, i pieni barrati e non selezionabili', () => {
  const html = renderToStaticMarkup(<Checkout piatti={[]} poke={null} disponibilita={{ zone: [],servizi: {
    asporto: { aperto: true,motivo: null,fasce: ['2026-10-12T16:30:00.000Z'],piene: ['2026-10-12T16:15:00.000Z'] },domicilio: { aperto: false,motivo: 'Consegne a domicilio non disponibili.',fasce: [],piene: [] } } }} />)
  expect(html.indexOf('18:15')).toBeLessThan(html.indexOf('18:30')); expect(html).toMatch(/<s>18:15<\/s>/); expect(html).toContain('pieno')
  expect(html).toContain('Ritiro alle'); expect(html).toContain('Consegne a domicilio non disponibili.'); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Conferma l’ordine/)
})
it('checkout: solo orari pieni', () => {
  const html = renderToStaticMarkup(<Checkout piatti={[]} poke={null} disponibilita={{ zone: [],servizi: {
    asporto: { aperto: true,motivo: null,fasce: [],piene: ['2026-10-12T16:15:00.000Z'] },domicilio: { aperto: false,motivo: null,fasce: [],piene: [] } } }} />)
  expect(html).toContain('Nessun orario libero per oggi'); expect(html).toMatch(/<s>18:15<\/s>/)
})
```
  Il vecchio test del checkout viene sostituito dal primo (stesse verifiche più gli orari pieni).
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Checkout in cinque passi con orari pieni barrati».

### Task 8: Stato dell'ordine con cronologia

**File:** modifica `src/app/(cliente)/ordine/[token]/StatoOrdine.tsx`, `page.tsx`; test in `src/app/(cliente)/componenti.test.tsx`.

**Consuma:** `passiOrdine`, `aggiornatoIl`, `etichettaClienteCasa`, `oraRoma`.

Riferimento: tavola `Casa-Stato`. «Ordine n. X» (h1, come oggi: l'e2e legge il numero dall'h1), stato grande (`role="status"`, testo `etichettaClienteCasa`), orario («Consegna verso le HH:MM» / «Ritiro alle HH:MM in Via Beato Giacomo 72, Bitetto»), indirizzo; `<ol>` dei passi: spunta per `fatto`, cerchio colorato per `attuale` (`aria-current="step"`), cerchio vuoto per `da_fare`; ora `oraRoma(creatoIl)` sul primo passo, `oraRoma(aggiornatoIl)` sul passo attuale se non è il primo. In attesa: «Aspettiamo la conferma del locale: questa pagina si aggiorna da sola.» e, dopo 10 minuti, l'avviso con il telefono (testi di oggi). Rifiutato: «Non possiamo accettare l'ordine: motivo», nessuna cronologia. Scontrino come in Task 7, «Paghi …» invariato, «Chiama il locale» (`tel:`) se c'è il telefono.

- [ ] **Passo 1: test** — i due test esistenti dello stato restano (aggiungendo `aggiornatoIl` al fixture: `'2026-10-12T16:03:00.000Z'`); nuovo:

```tsx
it('stato: cronologia con ora d’arrivo e ora dello stato attuale', () => {
  const html = renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'in_preparazione' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)
  expect(html).toContain('Ordine ricevuto'); expect(html).toContain('aria-current="step"'); expect(html).toContain('18:00'); expect(html).toContain('18:03'); expect(html).toContain('In consegna')
  expect(renderToStaticMarkup(<StatoOrdine ordine={{ ...ordine,stato: 'rifiutato',motivoRifiuto: 'Fascia piena' }} telefono={null} ora="2026-10-12T16:05:00.000Z" />)).not.toContain('Ordine ricevuto')
})
```
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Stato dell'ordine con cronologia».

### Task 9: Clienti al tavolo

**File:** modifica `src/app/tavolo/[chiave]/page.tsx`, `ModuloCodice.tsx`, `OrdinatoFinora.tsx`, `MenuOrdinabile.tsx`, riscrive `tavolo.css`; test in `componenti.test.tsx` della stessa cartella.

Riferimenti: tavole `Tavolo-Codice`, `Tavolo-Menu`, `Tavolo-Ordinato`.
- Senza accesso: «Benvenuti al» + nome del tavolo (h1), istruzione, campo «Codice del tavolo» (un solo `<input>` vero, grande, `b-num`, `letter-spacing` ampio, 4 cifre; niente caselle finte separate), errore, «Entra al tavolo», nota sul codice condiviso; saluto «Il tavolo è chiuso…» invariato.
- Con accesso: testata con logo, nome del tavolo (h1) e schede `b-schede` come ancore: «Menù» (`#menu`) e «Ordinato» (`#ordinato`) con il numero di ordini; poi il menù e la sezione «Ordinato finora» (`id="ordinato"`).
- `OrdinatoFinora`: card per ordine con «Ordine n. X», `EtichettaStato` (`etichettaStato`), «Mandato alle HH:MM», righe; barra scura finale «Totale del tavolo finora» + importo + «Il conto lo fai alla cassa».

- [ ] **Passo 1:** aggiornare il test di `OrdinatoFinora` (stesse verifiche; «Totale finora» → «Totale del tavolo finora») e il test del saluto (invariato). **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Pagine del tavolo in stile Banco».

### Task 10: Staff — barra, schede e inizio turno

**File:** crea `src/app/staff/vista.ts` (+test), `src/app/staff/BarraStaff.tsx`; modifica `src/app/staff/page.tsx`, `SchermoStaff.tsx`, `InizioTurno.tsx`, `OrdiniCasa.tsx` (solo `PannelloOrdiniOnline`), riscrive `staff.css`; test in `page.test.tsx` e `SchermoStaff.test.tsx`.

**Interfacce prodotte:**
- `type VistaStaff = 'ordini' | 'tavoli' | 'conti'`; `vistaStaff(v: unknown): VistaStaff` (default `'ordini'`).
- `BarraStaff({ vista, daGuardare, online }: { vista: VistaStaff; daGuardare: number; online: React.ReactNode | null })`: barra scura con «Staff», schede `<Link href="/staff?vista=…">` (`aria-current="page"` sulla corrente; badge su Ordini se `daGuardare > 0`), lo slot `online` e l'ora (`b-num`, aggiornata ogni 30 s dal client).
- `SchermoStaff({ dati, ora, vista })`: `vista` decide cosa si vede; tutto resta montato (suono, memoria degli arrivi).
- `page.tsx`: `AreaStaff({ searchParams }: { searchParams?: Promise<{ vista?: string }> })`; legge `vista` con `vistaStaff((await searchParams)?.vista)`. Titolo della pagina: `<h1 className="b-nascosto">Area staff</h1>` (il test lo cerca).

Contenuti:
- `InizioTurno` non iniziato: riquadro della tavola `Staff-Inizio` con data e ora (`toLocaleString` Roma), «Buon turno», le due voci, bottone `b-btn--principale b-btn--grande` «Inizia turno» (72 px), nota sugli ordini online. Iniziato: «Riattiva suono» come bottone nella barra (al posto dell'icona del suono) quando l'audio è sospeso; avvisi in `b-avviso`.
- Ordini online nella barra: bottone con punto verde «Ordini online aperti» / punto grigio «Ordini online chiusi» che apre un `Pannello` titolato «Ordini online»: stato di asporto e domicilio (testi di oggi), «Chiudi ordini online» / «Apri ordini di oggi», e in fondo il modulo «Esci». `PannelloOrdiniOnline` diventa il contenuto di quel pannello e mantiene il titolo `<h2>` «Ordini online: aperti oggi» / «Ordini online: chiusi».
- `daGuardare` = ordini da casa `in_attesa` + ordini nuovi non letti.

- [ ] **Passo 1: test (falliscono)**

```ts
// src/app/staff/vista.test.ts
import { expect, it } from 'vitest'
import { vistaStaff } from './vista'
it('vista dello staff: tre schede, ordini se il valore non è valido', () => {
  expect(['ordini','tavoli','conti','x',undefined,['tavoli']].map(vistaStaff)).toEqual(['ordini','tavoli','conti','ordini','ordini','ordini'])
})
```
```tsx
// in SchermoStaff.test.tsx: cambiando scheda il contenuto cambia ma la cucina resta montata (nascosta)
it('schede: tavoli visibili in «tavoli», la cucina resta nel DOM ma nascosta', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const dati = { tavoli: [],ordini: [tavolo],riepiloghi: [],contiRecenti: [],casa: [],ordiniOnline: online }
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T18:05:00Z" dati={dati} vista="tavoli" />)
  expect(html).toContain('Nessun tavolo configurato'); expect(html).toMatch(/<section[^>]*hidden=""[^>]*aria-label="Ordini"/)
})
```
  In `page.test.tsx` i quattro test restano; `AreaStaff()` si chiama senza argomenti (prop facoltativa).
- [ ] **Passo 2:** implementare (le tre viste sono `<section aria-label="Ordini|Tavoli|Conti" hidden={vista !== …}>`). **Passo 3:** `npx vitest run` verde. Commit «Staff: barra con schede e inizio turno».

### Task 11: Staff — ordini su quattro colonne

**File:** modifica `src/app/staff/SchermoStaff.tsx` (`CardOrdine`, vista ordini), `src/app/staff/OrdiniCasa.tsx` (`CardOrdineCasa`, `RifiutaOrdine`); test in `SchermoStaff.test.tsx`.

**Consuma:** `AltreAzioni`, `ConfermaAzione`, `DettaglioRighe`, `colonnaCucina`, `azioneAvanzaCasa`, `attesaLunga`.

Riferimento: tavola `Staff-Ordini`. Quattro colonne (`b-colonne`, 4 → 2 sotto 900 px → 1 sotto 600 px) con `<h2>`: «Da accettare», «Da preparare», «In preparazione», «Pronti e in consegna», punto del tono e conteggio; vuote: «Nessun ordine.» (da accettare vuota: «Nessun ordine da accettare.»).
- Titolo `<h3>` della card: tavolo `Tavolo 4 · n. 8` (nome grande, «· n. 8» più piccolo `b-num`); casa `Domicilio 19:30 · n. 9` / `Asporto 19:30 · n. 9` (tipo piccolo, orario grande). Il testo dell'h3, letto di seguito, resta identico a oggi (spazi veri tra le parti).
- Timer `b-num` in alto a destra: `${minuti}′` con `aria-label="${minuti} min"`; per la casa da accettare è arancione, rosso con «In attesa da più di 10 minuti» dopo 10 minuti (`attesaLunga`).
- Riga meta: totale; casa: cliente, telefono `tel:`, pagamento («Carta» / «Contanti (paga con X)»), indirizzo · zona · note e consegna per il domicilio (testi di oggi).
- Bottone principale con verbo: tavolo `inviato` → «Inizia a preparare», `in_preparazione` → «Segna servito»; casa: `accettato` → «Inizia a preparare», poi «Segna pronto», «Segna partito», «Segna consegnato» / «Segna ritirato». Nuova funzione locale `verbo(azioneAvanzaCasa(...))`: `{ 'In preparazione': 'Inizia a preparare', Pronto: 'Segna pronto', Partito: 'Segna partito', Consegnato: 'Segna consegnato', Ritirato: 'Segna ritirato' }`.
- Da accettare: «Accetta» principale, «Accetta +15’» e «Accetta +30’» secondari affiancati, «Rifiuta…» pericolo (apre il pannello di oggi «Rifiuta l'ordine n. X»).
- Altre azioni (`AltreAzioni`, titolo «Altre azioni · <titolo>»): «Segna come letto» (solo se nuovo), un `ConfermaAzione` «Annulla <piatto>» per riga non annullata, `ConfermaAzione` «Annulla tutto l'ordine» (domande di oggi).
- Ordine nuovo: classe `b-comanda--nuovo` (bordo arancione) + etichetta «Nuovo»; `onPointerDown` segna letto come oggi.

- [ ] **Passo 1: test** — aggiornare i quattro test esistenti mantenendo le verifiche:
  - card tavolo: `b-comanda--nuovo`, «senza sesamo», `b-nota`, «Tonno», `<s>`, `aria-label="5 min"`, «Inizia a preparare»;
  - card casa da accettare: «Domicilio», «19:30», «n. 9», `href="tel:3331234567"`, «Via Roma 1 · Bitetto · citofono Rossi», «Contanti (paga con 50,00 €)», i quattro bottoni `>Accetta<`, «Accetta +15’», «Accetta +30’», `>Rifiuta…<`, niente `b-comanda--ritardo` a 5 minuti e «In attesa da più di 10 minuti» a 11;
  - cucina: ordinamento per orario come oggi, «Pronti e in consegna», `>Segna ritirato<`, un solo «Accetta +15».
  Nuovo: il nome accessibile dell'h3 resta `Tavolo 1 · n. 8` (si verifica togliendo i tag dall'h3 nel markup: `html.match(/<h3[^>]*>(.*?)<\/h3>/)![1].replace(/<[^>]+>/g,'')` uguale a `'Tavolo 1 · n. 8'`).
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Staff: ordini su quattro colonne con un'azione per card».

### Task 12: Staff — tavoli

**File:** crea `src/app/staff/VistaTavoli.tsx`; modifica `SchermoStaff.tsx`; test in `SchermoStaff.test.tsx`.

**Consuma:** `riassuntoTavolo`, `LIMITE_SESSIONE`, `apriTavolo`, `sbloccaTavolo`, `ChiudiTavolo`.

Riferimento: tavola `Staff-Tavoli`. Legenda (Aperto, Libero, Da sbloccare). Griglia di riquadri dei tavoli `attivo || sessione`:
- aperto: `<button>` (`aria-pressed` se selezionato) con nome (h3 dentro il bottone non è valido: il nome è uno `<span>` e la card è un `<article>` con `<h3>` visivamente nascosto prima del bottone), codice `b-num` grande con `aria-label="Codice 4827"`, «dalle HH:MM · n ordini», etichetta «n in cucina» / «Tutto servito»; tentativi > 0: «n codici sbagliati» (rosso se `>= LIMITE_SESSIONE`).
- libero: riquadro tratteggiato con nome e «Apri tavolo».
- Dettaglio del tavolo selezionato (colonna a destra sopra i 900 px, `Pannello` sotto): nome, «dalle», codice gigante, ordini, in cucina, totale, «Apri il conto» (link a `/staff/conto/<id>`), «Sblocca» se `tentativi > 0` con il testo di oggi sui tentativi, `ChiudiTavolo` («Chiudi tavolo» con la conferma di oggi). Il primo tavolo aperto è selezionato all'inizio.

- [ ] **Passo 1: test (falliscono)**

```tsx
it('tavoli: aperto con codice e riassunto, libero con «Apri tavolo», dettaglio con conto e chiusura', async () => {
  const { SchermoStaff } = await import('./SchermoStaff')
  const sessione = { id: 's',codice: '4827',apertaIl: '2026-10-11T18:05:00.000Z',tentativi: 0 }
  const tavoli = [{ id: 't1',nome: 'Tavolo 1',slug: 'tavolo-1',chiave: 'k1',posizione: 1,attivo: true,sessione },{ id: 't2',nome: 'Tavolo 2',slug: 'tavolo-2',chiave: 'k2',posizione: 2,attivo: true,sessione: null }]
  const html = renderToStaticMarkup(<SchermoStaff ora="2026-10-11T18:10:00Z" vista="tavoli" dati={{ tavoli,ordini: [{ ...tavolo,sessioneId: 's' }],riepiloghi: [{ sessioneId: 's',numeroOrdini: 1,totaleCent: 900 }],contiRecenti: [],casa: [],ordiniOnline: online }} />)
  expect(html).toContain('aria-label="Codice 4827"'); expect(html).toContain('1 in cucina'); expect(html).toContain('Apri tavolo'); expect(html).toContain('href="/staff/conto/s"'); expect(html).toContain('Chiudi tavolo')
})
```
  Il campo `sessione` del fixture segue il tipo `TavoloStaff`: completare i campi mancanti indicati da `npm run typecheck`.
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Staff: piantina dei tavoli con dettaglio».

### Task 13: Staff — conti

**File:** crea `src/app/staff/VistaConti.tsx`, `src/app/staff/ElencoConti.tsx`; modifica `SchermoStaff.tsx`, `src/app/staff/conto/[sessione]/page.tsx`, `VoceConto.tsx`, `ChiusuraConto.tsx` (+test), `ChiudiTavolo.tsx`.

**Interfacce prodotte:** `ElencoConti({ aperti, recenti, corrente }: { aperti: { id: string; nome: string; totaleCent: number }[]; recenti: { id: string; nome: string; chiusaIl: string }[]; corrente: string | null })`: due liste di link a `/staff/conto/<id>` («Tavoli aperti», «Chiusi nelle ultime 6 ore»; vuote: «Nessun tavolo aperto.», «Nessun tavolo chiuso nelle ultime 6 ore.»), `aria-current="page"` sul corrente.

Riferimento: tavola `Staff-Conti`.
- Vista Conti dello schermo: `ElencoConti` a sinistra, a destra «Scegli un tavolo per vedere il conto.».
- Pagina del conto: stessa cornice (`BarraStaff` con `vista="conti"`, `daGuardare=0`, `online=null`), `ElencoConti` (legge `elencoTavoli`, `riepiloghiTavoli`, `contiRecenti`) e il conto: «aperto il …», `<h1>` «Conto · <tavolo>», «Stampa» (`window.print()` in un piccolo bottone client), avviso `AvvisoContoCambiato` in `b-avviso--accettare` con «Ho ricontrollato» (testi di oggi), tabella N./Piatto/Q.tà/Importo con «Annulla» discreto pericolo per voce (`ConfermaAzione stile="discreto"`, domanda di oggi), voce nuova rispetto al conto visto con etichetta «nuovo», totale grande, «Da battere in cassa · non è uno scontrino fiscale», `ChiudiTavolo primaria` come bottone `b-btn--pieno-pericolo` «Chiudi tavolo». Tavolo chiuso: «Tavolo chiuso alle HH:MM» al posto dei bottoni.
- Stampa: niente barra, elenco e bottoni (`@media print`).

- [ ] **Passo 1:** aggiornare `ChiusuraConto.test.tsx` (stesse verifiche sul testo dell'avviso e «Ho ricontrollato il conto» → «Ho ricontrollato»); nuovo test di `ElencoConti` (link e `aria-current`). **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Staff: conti con elenco e conto in stile Banco».

### Task 14: Admin — cornice e navigazione

**File:** crea `src/app/admin/NavAdmin.tsx` (client), `src/app/admin/NavAdmin.test.tsx`; modifica `src/app/admin/layout.tsx`, riscrive `src/app/admin/admin.css`.

**Interfacce prodotte:** `NavAdmin({ daConfermare }: { daConfermare: number })`: usa `usePathname()`; voci `{ href: '/admin/menu', testo: 'Menù', badge: daConfermare }`, `'/admin/poke' Poke`, `'/admin/tavoli' 'Tavoli e QR'`, `'/admin/domicilio' 'Domicilio e asporto'`; voce attiva se `pathname === href || pathname.startsWith(href + '/')`. Barra laterale sopra gli 800 px con in fondo «Schermo staff ↗», «Menù dei clienti ↗» e il modulo «Esci»; sotto gli 800 px barra in basso con le 4 voci (icone SVG di linea come nella tavola) + «Altro» che apre un `Pannello` con i link esterni ed «Esci». Il layout legge `contaAllergeniDaConfermare(db)` e passa il numero.

- [ ] **Passo 1: test (fallisce)**

```tsx
// src/app/admin/NavAdmin.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation',() => ({ usePathname: () => '/admin/menu/abc' }))
vi.mock('@/app/accesso/azioni',() => ({ esci: vi.fn() }))
import { NavAdmin } from './NavAdmin'
it('evidenzia la sezione corrente e mostra il badge degli allergeni', () => {
  const html = renderToStaticMarkup(<NavAdmin daConfermare={12} />)
  expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/admin\/menu"|<a[^>]*href="\/admin\/menu"[^>]*aria-current="page"/)
  expect(html).toContain('12'); expect(html).toContain('Domicilio e asporto'); expect(html).toContain('Schermo staff')
})
```
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Admin: cornice con navigazione chiara».

### Task 15: Admin — menù e modifica piatto

**File:** crea `src/app/admin/menu/ElencoPiatti.tsx` (client) e `src/app/admin/menu/ElencoPiatti.test.tsx`; modifica `src/app/admin/menu/page.tsx`, `src/app/admin/menu/[id]/page.tsx`, `ModuloPiatto.tsx`.

**Interfacce prodotte:** `ElencoPiatti({ categorie, cambia }: { categorie: { id: string; nome: string; pezzi: string | null; piatti: { id: string; numero: number | null; nome: string; prezzoCent: number; allergeniConfermati: boolean; disponibile: boolean }[] }[]; cambia: (id: string, disponibile: boolean) => Promise<void> })`. `cambia` è `cambiaDisponibilita` (azione del server di oggi, firma `(id, disponibile)`: verificare in `src/app/admin/menu/azioni.ts` e adeguare la prop alla firma vera).

- `page.tsx`: `filtro` accetta anche `'esauriti'` (solo `!disponibile`); titolo «Menù» + «N piatti in M categorie»; avviso allergeni (testi di oggi, link «Mostra solo questi» / «Mostra tutti»); schede `b-schede` di link: «Tutti», «Allergeni da confermare N», «Esauriti N».
- `ElencoPiatti`: campo «Cerca un piatto» (placeholder «Sake roll, 29…»); filtro per nome (minuscole, senza accenti con `normalize('NFD')`) o numero esatto; categorie vuote nascoste; nessun risultato: «Nessun piatto trovato.». Tabella per categoria in `b-tabella-scorre` (`overflow-x: auto`): N., Piatto, Prezzo, Allergeni (`b-stato--pronto` «Confermati» / `b-stato--accettare` «Da confermare»), Stasera (`<form action>` con `button.b-interruttore role="switch" aria-checked`, testo «Disponibile»/«Esaurito», `b-nascosto` «<nome>: » prima), «Modifica».
- Modifica piatto: «← Menù · <categoria>» (`leggiPiatto` dà `categoriaId`; il nome si prende da `leggiMenu` oppure si scrive solo «← Menù» se non disponibile senza query nuove), numero e nome (h1), etichetta allergeni; modulo in due blocchi («Come appare nel menù», «Allergeni») con i campi e i `name` di oggi; conferma allergeni evidenziata che anticipa il testo per il cliente (`testoAllergeni` sui valori iniziali); barra fissa con «Annulla» (link al menù) e «Salva il piatto»; esito «Salvato.» e errori di oggi.

- [ ] **Passo 1: test (falliscono)**

```tsx
// src/app/admin/menu/ElencoPiatti.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ElencoPiatti, filtraCategorie } from './ElencoPiatti'
const categorie = [{ id: 'tartare',nome: 'Tartare',pezzi: null,piatti: [{ id: 'a',numero: 1,nome: 'Salmone',prezzoCent: 600,allergeniConfermati: true,disponibile: true },{ id: 'b',numero: 4,nome: 'Mini Tonno',prezzoCent: 600,allergeniConfermati: false,disponibile: false }] },
  { id: 'sashimi',nome: 'Sashimi',pezzi: '5 pz.',piatti: [{ id: 'c',numero: 5,nome: 'Salmone',prezzoCent: 500,allergeniConfermati: true,disponibile: true }] }]
it('ricerca per nome (senza accenti e maiuscole) o per numero, categorie vuote nascoste', () => {
  expect(filtraCategorie(categorie,'TONNO').map(c => c.piatti.map(p => p.id))).toEqual([['b']])
  expect(filtraCategorie(categorie,'5').map(c => c.id)).toEqual(['sashimi'])
  expect(filtraCategorie(categorie,'  ')).toEqual(categorie)
  expect(filtraCategorie(categorie,'zzz')).toEqual([])
})
it('interruttore e stato degli allergeni per ogni piatto', () => {
  const html = renderToStaticMarkup(<ElencoPiatti categorie={categorie} cambia={async () => {}} />)
  expect(html).toContain('aria-checked="false"'); expect(html).toContain('Esaurito'); expect(html).toContain('Da confermare'); expect(html).toContain('href="/admin/menu/a"')
})
```
  `filtraCategorie(categorie, testo)` è esportata da `ElencoPiatti.tsx` e usata dal componente.
- [ ] **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Admin: menù con ricerca e filtro Esauriti, modifica piatto».

### Task 16: Admin — tavoli, poke e domicilio

**File:** modifica `src/app/admin/tavoli/page.tsx`, `ModuloTavolo.tsx`, `stampa/page.tsx`, `src/app/admin/poke/page.tsx`, `ModuloPoke.tsx`, `ModuloAllergeniPoke.tsx`, `src/app/admin/domicilio/page.tsx`, `ModuliDomicilio.tsx`.

**Consuma:** `requisitiCasa`.

Riferimenti: tavole `Admin-Tavoli`, `Admin-Poke`, `Admin-Domicilio`.
- **Tavoli:** testata con spiegazione, «Stampa i QR» (secondario) e «Aggiungi tavolo» (principale, apre un `Pannello` con il `ModuloTavolo` nuovo); avviso APP_URL di oggi; griglia di card: anteprima del QR (SVG generato con `QRCode.toString` come nella stampa, 96 px; senza `url` un riquadro con «QR non disponibile»), nome (h2), etichetta «Attivo»/«Disattivato», link, campi «Nome» e «Ordine» (`name="posizione"`, come oggi), «Attivo» come `b-interruttore` (checkbox vera con `role="switch"`, `name="attivo"`), «Salva», `ConfermaAzione` «Nuovo QR» con domanda di oggi. Stampa: tipografia Banco, regole di stampa di oggi.
- **Poke:** schede-ancora «Prezzi e regole» (`#regole`) e «Allergeni degli ingredienti» (`#allergeni`, punto arancione se non confermati); `ModuloPoke`: prezzi in un riquadro, tabella dei gruppi con Minimo/Massimo/Inclusi (`name` di oggi), spiegazione di «Inclusi», «Salva le regole»; `ModuloAllergeniPoke`: per ogni gruppo una griglia di `details` per ingrediente (riassunto: nome + allergeni o «nessun allergene»), conferma «Ho verificato gli allergeni di tutti gli ingredienti», «Salva allergeni»; avviso di oggi se non confermati.
- **Domicilio:** sezione «Si possono aprire gli ordini da casa?» con `requisitiCasa({ telefono: impostazioni.telefono, allergeniCompleti: completi, pokeConfermati: poke ? poke.confermati : null, zoneAttive: zone.filter(z => z.attiva).length })`: spunta verde per `ok`, punto esclamativo arancione altrimenti, link a destra; poi due colonne: «Orari della settimana» (tabella Giorno/Asporto/Domicilio, turni come pillole con il `BottoneRimuovi` «×» e `aria-label` «Rimuovi <servizio> <giorno> <dalle>», «Nessun turno»; «Aggiungi turno» apre un `Pannello` con `ModuloOrario`) e a destra «Zone di consegna» (card per zona; ogni zona apre un `Pannello` con `ModuloZona`; «Aggiungi» con `ModuloZona` vuoto) e «Quanti ordini reggiamo» (`ModuloImpostazioni`, `id="impostazioni"`); in fondo «Chiusure straordinarie» (elenco con «Rimuovi», «Aggiungi un giorno» in `Pannello`). I tre avvisi separati di oggi spariscono (li sostituisce la lista).

- [ ] **Passo 1:** creare il componente puro `Requisiti({ voci }: { voci: Requisito[] })` in `src/app/admin/domicilio/Requisiti.tsx` con il test `src/app/admin/domicilio/Requisiti.test.tsx`: una voce `ok` mostra la spunta (`aria-label="Fatto"`), una voce da fare mostra il testo e il link «Conferma nel menù» con `href="/admin/menu?filtro=allergeni"`. **Passo 2:** implementare. **Passo 3:** `npx vitest run` verde. Commit «Admin: tavoli, poke e domicilio in stile Banco».

### Task 17: Accesso, pagine di servizio e pulizia

**File:** modifica `src/app/accesso/page.tsx`, `ModuloAccesso.tsx`, `accesso.css`, `src/app/not-found.tsx`, `src/app/admin/error.tsx`, `src/app/staff/error.tsx`, `src/app/tavolo/[chiave]/error.tsx`, `src/app/(cliente)/privacy/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`; cancella `src/styles/ds/cupertino.css`, `tokens.css`, `bundle.css`, `src/styles/menu.css`.

- Accesso (tavola `Accesso`): fondo inchiostro, «Daniel's Sushi» `b-num`, «Gestionale» (h1), «Accesso per lo staff e per l'admin.», modulo chiaro con «Email», «Password», errore `b-avviso--ritardo`, «Entra»; nota in fondo. Le etichette restano «Email» e «Password» (e2e).
- Errori e not-found: testi di oggi, `b-btn--principale`, link discreti.
- Privacy: tipografia Banco, avviso del testo provvisorio in `b-avviso--accettare`.
- Pulizia: `grep -rn "ds-\|--carta\|--inchiostro\|--indaco\|--bianco\|--sp-\|heading\|tavolo-\|casa-\|staff-\|admin-" src` non deve trovare più classi o variabili Cupertino (le classi d'area nuove usano il prefisso `b-`); `globals.css` tiene solo ciò che non è in `base.css` o viene cancellato; il layout radice importa solo i fogli Banco.

- [ ] **Passo 1:** cancellare i fogli Cupertino e lanciare `npm run typecheck` e `npx vitest run`: devono restare verdi. **Passo 2:** `npm run build` verde. Commit «Accesso e pagine di servizio in stile Banco; via Cupertino».

### Task 18: E2E e verifica finale

**File:** modifica `e2e/tavolo.spec.ts`, `e2e/casa.spec.ts`, `e2e/aiuti.ts`.

- `aiuti.ts`: dopo «Inizia turno» si attende la colonna «Da preparare» (`getByRole('heading',{ name: /^Da preparare/ })`) al posto di «Cucina».
- `tavolo.spec.ts`: il riquadro del tavolo si trova nella scheda Tavoli (`staff.goto('/staff?vista=tavoli')` o clic sulla scheda «Tavoli»); «Apri tavolo»; codice da `getByLabel(/^Codice \d{4}$/)`; carrello `getByRole('button',{ name: /^Carrello · 1 piatti/ })` (nome accessibile invariato); poke: dialog «Componi poke», passo Base «Riso bianco» → «Avanti: Proteine» → «Salmone crudo» → avanti fino all'ultimo passo → «Aggiungi al carrello»; in cucina (scheda Ordini) «Inizia a preparare» e «Segna servito»; il riepilogo «2 ordini · 15,00 €» si legge nel dettaglio del tavolo; «Chiudi tavolo» dal dettaglio con il dialog «Conferma».
- `casa.spec.ts`: «Apri ordini di oggi» è nel pannello «Ordini online» (prima clic su «Ordini online chiusi»), poi si chiude il pannello; heading «Ordini online: aperti oggi» nel pannello; il cliente usa la barra «Carrello · 3 piatti»; nel checkout l'orario si sceglie con `getByRole('radiogroup',{ name: 'Consegna verso le' }).getByRole('radio').first()` (il testo dell'orario dalla sua etichetta); «Email (per la conferma)», «Carta (POS)», privacy e «Conferma l'ordine · 20,00 €» invariati; passi dello staff «Inizia a preparare», «Segna pronto», «Segna partito», «Segna consegnato».

- [ ] **Passo 1:** aggiornare gli e2e. **Passo 2:** `npm run e2e` (serve `.env.local` con `E2E_EMAIL`/`E2E_PASSWORD`; se nel worktree manca, copiarlo dalla cartella principale del progetto senza mostrarne il contenuto) → 2 passed.
- [ ] **Passo 3: controllo visivo.** DB locale con PGlite (come nella tappa 4: `npx tsx --env-file=.env.local e2e/db-locale.ts`, poi `next dev` con `DATABASE_URL` locale dal pannello di anteprima). Per ogni tavola del canvas, la pagina vera a 390×844, 1180×820 e 1280 px, chiaro e scuro: niente sovrapposizioni, niente scorrimento orizzontale della pagina, barre fisse che non coprono il contenuto, testo al 200 % che va a capo.
- [ ] **Passo 4:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` verdi. Commit «E2E aggiornati al design Banco».
