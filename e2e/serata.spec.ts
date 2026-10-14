// Simulazione di una serata nel locale, sul database finto di e2e/db-locale.ts (mai quello reale).
// Uso: npm run serata. Tempi compressi: una serata in circa 10 minuti.
// Attori: un tablet in sala (apre e chiude i tavoli, segna esauriti), un tablet in cucina
// (accetta gli ordini da casa e porta avanti le comande), 6 tavoli con 2–4 telefoni ciascuno
// e 5 clienti da casa. In mezzo, gli imprevisti di una serata vera.
// Alla fine controlla sul database che nessun ordine sia andato perso o doppio e che i conti tornino,
// e scrive tempi e problemi in test-results/serata/risultati.json.
import { expect, test, type Browser, type Page } from '@playwright/test'
import pg from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'
import { apriTelefono, oraDiRoma, scheda } from './aiuti'
import { URL_DB } from './dati'

test.setTimeout(30 * 60_000)

// Numeri casuali ripetibili: la stessa serata a ogni esecuzione.
let seme = 20261014
const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648 }
const tra = (min: number, max: number) => min + Math.floor(caso() * (max - min + 1))
const attendi = (ms: number) => new Promise(r => setTimeout(r,ms))

const t0 = Date.now()
const secondi = () => Math.round((Date.now() - t0) / 100) / 10
const eventi: { t: number; chi: string; cosa: string }[] = []
const problemi: { t: number; chi: string; cosa: string }[] = []
const log = (chi: string, cosa: string) => { eventi.push({ t: secondi(),chi,cosa }); console.log(`[${secondi().toFixed(1).padStart(6)} s] ${chi.padEnd(14)} ${cosa}`) }
const osservazioni: { t: number; chi: string; cosa: string }[] = []
const osserva = (chi: string, cosa: string) => { osservazioni.push({ t: secondi(),chi,cosa }); log(chi,`OSSERVAZIONE: ${cosa}`) }
const problema = (chi: string, cosa: string) => { problemi.push({ t: secondi(),chi,cosa }); log(chi,`PROBLEMA: ${cosa}`) }
const lente: { t: number; chi: string; cosa: string }[] = []
const lenta = (chi: string, cosa: string) => { lente.push({ t: secondi(),chi,cosa }); log(chi,`LENTA: ${cosa}`) }
const misure = { invioTavolo: [] as number[],arrivoInCucina: [] as number[],arrivoDopoStandby: [] as number[],invioCasa: [] as number[],aperturaMenu: [] as number[],ingressoTavolo: [] as number[] }

// Ordini andati a buon fine secondo i clienti: il database alla fine deve dire esattamente questo.
interface Inviato { tavolo: string; numero: number; totaleCent: number; inviatoAlle: number }
const inviati: Inviato[] = []
const visteInCucina = new Map<string,number>()
// Gli ordini mandati mentre il tablet della cucina è in standby si misurano a parte.
const standby: { da: number; a: number | null }[] = []
const inStandby = (t: number) => standby.some(s => t >= s.da && (s.a === null || t <= s.a))
const daCasa: { numero: number; nome: string; tipo: string; totaleCent: number; inviatoAlle: number }[] = []

const PIATTI: [categoria: string, nome: string][] = [
  ['tartare','Salmone'],['tartare','Tonno'],['sashimi','Salmone'],['nigiri','Salmone'],['nigiri','Tonno scottato'],['sushi-gio','Gio salmone'],
  ['sushi-gio','Philadelphia Gio'],['hosomaki','Tonno'],['hosomaki','Gambero in tempura'],['uramaki','Salmone roll'],['special-roll','Sake roll'],
  ['special-roll','Daniel\'s roll'],['special-roll','Rainbow roll'],['special-roll','Spicy Salm roll'],['starter','Gamberi in tempura'],
  ['starter','Takoyaki'],['poke-bowl','Daniel\'s poke'],['primi','Ramen'],['primi','Gyoza'],['beverage','Coca Cola'],['beverage','Acqua naturale'],
  ['beverage','Birra Asahi'],['dessert','Tiramisù'],
]
// Next mette nella pagina un annuncio vuoto con role=alert: contano solo gli avvisi con un testo.
// Lo stesso errore può comparire due volte (pagina e carrello aperto): basta il primo.
const avviso = (p: Page) => p.getByRole('alert').filter({ hasText: /\S/ }).first()
const euroInCent = (testo: string) => Math.round(Number(testo.replace(/\./g,'').replace(',','.')) * 100)

// Le azioni su una pagina condivisa (il tablet della sala) passano una alla volta, come una persona sola.
function fila() {
  let coda = Promise.resolve()
  return <T>(fn: () => Promise<T>): Promise<T> => { const p = coda.then(fn); coda = p.then(() => undefined,() => undefined); return p }
}

async function tabletStaff(browser: Browser, nome: string): Promise<Page> {
  const { E2E_EMAIL: email,E2E_PASSWORD: password } = process.env
  if (!email || !password) throw new Error('Servono E2E_EMAIL ed E2E_PASSWORD in .env.local')
  const page = await (await browser.newContext({ viewport: { width: 1180,height: 820 },hasTouch: true })).newPage()
  await page.goto('/accesso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{ name: 'Entra' }).click()
  await page.waitForURL('**/admin')
  await page.goto('/staff')
  await page.getByRole('button',{ name: 'Inizia turno' }).click()
  await expect(page.getByRole('heading',{ name: /^Da preparare/ })).toBeVisible()
  // Le richieste lente del tablet (azioni e aggiornamenti dello schermo) finiscono nel registro.
  page.on('requestfinished',r => {
    const durata = r.timing().responseEnd
    if (durata > 2500) lenta(nome,`${r.method()} ${new URL(r.url()).pathname}${r.headers()['next-action'] ? ' (azione)' : r.headers()['rsc'] ? ' (aggiornamento)' : ''} ${(durata / 1000).toFixed(1)} s`)
  })
  // ERR_ABORTED è normale (precaricamenti e aggiornamenti sostituiti da uno più recente): contano gli altri errori.
  page.on('requestfailed',r => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') lenta(nome,`FALLITA ${r.method()} ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`) })
  log(nome,'turno iniziato')
  return page
}

// ── Telefono al tavolo ────────────────────────────────────────────────────────────────────────
async function entra(tel: Page, chiave: string, codice: string, chi: string) {
  const inizio = Date.now()
  await tel.goto(`/tavolo/${chiave}`)
  await tel.getByLabel('Codice del tavolo').fill(codice)
  await tel.getByRole('button',{ name: 'Entra al tavolo' }).click()
  await expect(tel.getByRole('button',{ name: /^Rivedi e manda in cucina · / })).toBeVisible({ timeout: 30_000 })
  misure.ingressoTavolo.push(Date.now() - inizio)
  log(chi,'seduto al tavolo')
}

async function aggiungi(tel: Page, [categoria,nome]: [string,string], quanti: number) {
  const sezione = tel.locator(`#${categoria}`)
  await sezione.getByRole('button',{ name: `Aggiungi ${nome}`,exact: true }).click()
  for (let i = 1; i < quanti; i++) await sezione.getByRole('button',{ name: `Aumenta ${nome}`,exact: true }).click()
}

async function componiPoke(tel: Page) {
  await tel.getByRole('button',{ name: 'Componi la tua poke' }).click()
  const poke = tel.getByRole('dialog',{ name: 'Componi poke' })
  await poke.getByLabel('Riso bianco').check()
  await poke.getByRole('button',{ name: /^Avanti: Proteine/ }).click()
  await poke.getByLabel('Salmone crudo').check()
  await poke.getByLabel('Tonno crudo').check()
  const aggiungiBtn = poke.getByRole('button',{ name: 'Aggiungi al carrello' })
  while (!await aggiungiBtn.isVisible()) await poke.getByRole('button',{ name: /^Avanti: / }).click()
  await aggiungiBtn.click()
}

type Imprevisto = 'doppio-tocco' | 'risposta-persa' | 'offline' | null
/** Apre il carrello e manda l'ordine. Torna il numero, o null se il server l'ha rifiutato (messaggio in `errore`). */
async function invia(tel: Page, tavolo: string, chi: string, imprevisto: Imprevisto = null): Promise<{ numero: number | null; errore?: string }> {
  const barra = tel.getByRole('button',{ name: /^Rivedi e manda in cucina · \d+ piatti/ })
  const etichetta = (await barra.getAttribute('aria-label')) ?? (await barra.textContent())!
  const totaleCent = euroInCent(etichetta.match(/([\d.]+,\d{2})/)![1])
  const bottone = tel.getByRole('button',{ name: 'Invia ordine' })
  if (!await bottone.isVisible()) await barra.click()
  const esito = tel.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ }).first()
  const errore = avviso(tel)
  const inizio = Date.now()
  if (imprevisto === 'doppio-tocco') {
    await bottone.dblclick()
    log(chi,'doppio tocco su «Invia ordine»')
  } else if (imprevisto === 'offline') {
    await tel.context().setOffline(true)
    await bottone.click()
    await expect(errore).toBeVisible()
    log(chi,`senza rete all'invio, il telefono dice: «${(await errore.first().textContent())!.trim()}»`)
    await tel.context().setOffline(false)
    await attendi(1500)
    await bottone.click()
  } else if (imprevisto === 'risposta-persa') {
    // L'ordine arriva al server, ma la risposta si perde per strada (rete che cade nel momento sbagliato).
    let perse = 0
    await tel.route('**/*',async route => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action'] && perse === 0) {
        perse++
        await route.fetch()
        await route.abort('connectionreset')
      } else await route.fallback()
    })
    await bottone.click()
    await expect(errore).toBeVisible()
    log(chi,`risposta persa dopo l'invio, il telefono dice: «${(await errore.first().textContent())!.trim()}»`)
    await tel.unroute('**/*')
    await bottone.click()
  } else await bottone.click()
  // Il telefono toglie l'errore vecchio a ogni invio: si aspetta il messaggio di successo o un errore nuovo.
  let testoErrore: string | null = null
  for (const scadenza = Date.now() + 30_000; Date.now() < scadenza; await attendi(200)) {
    if (await esito.isVisible()) break
    // A tavolo chiuso il server rifiuta e il telefono torna alla schermata di saluto.
    if (await tel.getByText('Il tavolo è chiuso, grazie per essere stati da noi!').count()) { testoErrore = 'schermata «Il tavolo è chiuso, grazie per essere stati da noi!»'; break }
    if (await bottone.count() && await bottone.isEnabled({ timeout: 1000 }) && await errore.count()) { testoErrore = (await errore.first().textContent())!.trim(); break }
  }
  if (!await esito.isVisible()) {
    if (testoErrore === null) throw new Error(`${chi}: nessuna risposta all'invio entro 30 s`)
    log(chi,`ordine rifiutato: «${testoErrore}»`)
    return { numero: null,errore: testoErrore }
  }
  const numero = Number((await esito.textContent())!.match(/n\. (\d+)/)![1])
  misure.invioTavolo.push(Date.now() - inizio)
  inviati.push({ tavolo,numero,totaleCent,inviatoAlle: Date.now() })
  log(chi,`ordine n. ${numero} inviato (${(totaleCent / 100).toFixed(2)} €) in ${Date.now() - inizio} ms`)
  const fine = tel.getByRole('button',{ name: 'Fine' })
  if (await fine.isVisible()) await fine.click()
  return { numero }
}

/** Un giro di ordinazione: da 1 a 4 piatti diversi, a volte una poke composta. */
async function giro(tel: Page, tavolo: string, chi: string, imprevisto: Imprevisto = null, obbligatori: [string,string][] = []) {
  const scelti = new Map<string,[string,string]>()
  for (const p of obbligatori) scelti.set(p.join('|'),p)
  while (scelti.size < Math.max(obbligatori.length,tra(1,4))) { const p = PIATTI[tra(0,PIATTI.length - 1)]; scelti.set(p.join('|'),p) }
  for (const p of scelti.values()) await aggiungi(tel,p,tra(1,2))
  if (caso() < 0.15) await componiPoke(tel)
  return invia(tel,tavolo,chi,imprevisto)
}

// ── Cucina ────────────────────────────────────────────────────────────────────────────────────
const RIFIUTA = 'Rifiuto Prova'
async function cucina(page: Page, stato: { fine: boolean; standby: boolean }) {
  await scheda(page,'Ordini')
  const titolo = /^(Tavolo \d+|Domicilio \d\d:\d\d|Asporto \d\d:\d\d) · n\. \d+$/
  while (!stato.fine) {
    if (stato.standby) { await attendi(500); continue }
    try {
      for (const t of await page.getByRole('heading',{ name: titolo }).allTextContents()) {
        const n = t.match(/n\. (\d+)$/)![1]
        if (!visteInCucina.has(n)) {
          visteInCucina.set(n,Date.now())
          const inviato = inviati.find(i => String(i.numero) === n) ?? daCasa.find(i => String(i.numero) === n)
          if (inviato) (inStandby(inviato.inviatoAlle) ? misure.arrivoDopoStandby : misure.arrivoInCucina).push(Date.now() - inviato.inviatoAlle)
          log('cucina',`vede ${t}${inviato ? ` dopo ${((Date.now() - inviato.inviatoAlle) / 1000).toFixed(1)} s` : ''}`)
        }
      }
      // Prima gli ordini da casa da accettare, poi la comanda più vecchia.
      const daAccettare = page.locator('article').filter({ has: page.getByRole('button',{ name: /^Accetta/ }) }).first()
      if (await daAccettare.count()) {
        const testo = (await daAccettare.textContent({ timeout: 5000 })) ?? ''
        const titoloCard = (await daAccettare.getByRole('heading').first().textContent({ timeout: 5000 }))!
        if (testo.includes(RIFIUTA)) {
          await daAccettare.getByRole('button',{ name: 'Rifiuta…' }).click()
          const pannello = page.getByRole('dialog',{ name: /^Rifiuta l’ordine n\. / })
          await pannello.getByRole('radio').first().check()
          await pannello.getByRole('button',{ name: 'Rifiuta ordine' }).click()
          log('cucina',`rifiuta ${titoloCard}`)
        } else {
          const scelta = ['Accetta','Accetta +15’','Accetta +30’'][tra(0,2)]
          const inizioAzione = Date.now()
          await daAccettare.getByRole('button',{ name: scelta,exact: true }).click({ timeout: 5000 })
          log('cucina',`${scelta} su ${titoloCard}${Date.now() - inizioAzione > 2000 ? ` (pulsante pronto dopo ${((Date.now() - inizioAzione) / 1000).toFixed(1)} s)` : ''}`)
        }
      } else {
        // Come in una cucina vera, si alterna tra iniziare comande nuove e servire quelle pronte.
        const avanti = /^(Segna servito|Segna pronto|Segna partito|Segna consegnato|Segna ritirato)$/
        const passo = page.getByRole('button',{ name: caso() < 0.5 && await page.getByRole('button',{ name: avanti }).count() ? avanti : /^(Inizia a preparare|Segna servito|Segna pronto|Segna partito|Segna consegnato|Segna ritirato)$/ })
        const card = page.locator('article').filter({ has: passo }).first()
        if (await card.count()) {
          const titoloCard = await card.getByRole('heading').first().textContent({ timeout: 5000 })
          const azione = card.getByRole('button',{ name: /^(Inizia a preparare|Segna servito|Segna pronto|Segna partito|Segna consegnato|Segna ritirato)$/ }).first()
          const inizioAzione = Date.now()
          const nome = await azione.textContent({ timeout: 5000 })
          await azione.click({ timeout: 5000 })
          log('cucina',`${nome} · ${titoloCard}${Date.now() - inizioAzione > 2000 ? ` (pulsante pronto dopo ${((Date.now() - inizioAzione) / 1000).toFixed(1)} s)` : ''}`)
        }
      }
    } catch (err) {
      // Una card che sparisce mentre la si legge (aggiornamento dello schermo) non è un problema.
      if (!stato.fine && !/detached|Target closed|strict mode/.test(String(err))) log('cucina',`riprovo: ${String(err).split('\n')[0]}`)
    }
    await attendi(tra(300,900))
  }
}

// ── Cliente da casa ───────────────────────────────────────────────────────────────────────────
async function clienteDaCasa(browser: Browser, nome: string, telefono: string, tipo: 'asporto' | 'domicilio', piatti: [string,string][]) {
  const tel = await apriTelefono(browser)
  const inizio = Date.now()
  await tel.goto('/')
  misure.aperturaMenu.push(Date.now() - inizio)
  for (const p of piatti) await aggiungi(tel,p,2)
  await tel.getByRole('button',{ name: /^Vedi il carrello · / }).click()
  await tel.getByRole('button',{ name: 'Vai al riepilogo' }).click()
  await tel.waitForURL('**/ordina')
  if (tipo === 'domicilio') {
    await tel.getByLabel('Consegna a domicilio').check()
    await tel.getByLabel('Zona').selectOption({ label: 'Centro · consegna 2,00 € · minimo 15,00 €' })
    await tel.getByLabel('Indirizzo e numero civico').fill('Via Roma 1')
  } else await tel.getByLabel('Ritiro al locale (asporto)').check()
  const gruppo = tel.getByRole('radiogroup',{ name: tipo === 'domicilio' ? 'Consegna verso le' : 'Ritiro alle' })
  const liberi = gruppo.locator('label').filter({ has: tel.getByRole('radio',{ disabled: false }) })
  const pieni = await gruppo.locator('label').filter({ has: tel.getByRole('radio',{ disabled: true }) }).count()
  const orario = liberi.first()
  const ora = (await orario.textContent())!.trim()
  await orario.click()
  await tel.getByLabel('Nome').fill(nome)
  await tel.getByLabel('Telefono').fill(telefono)
  await tel.getByLabel('Email (per la conferma)').fill(`${nome.split(' ')[0].toLowerCase()}@esempio.it`)
  await tel.getByLabel(tipo === 'domicilio' ? 'Contanti' : 'Carta (POS)').check()
  await tel.getByLabel(/informativa privacy/).check()
  const conferma = tel.getByRole('button',{ name: /^Conferma l’ordine · / })
  const totaleCent = euroInCent((await conferma.textContent())!.match(/([\d.]+,\d{2})/)![1])
  const invio = Date.now()
  await conferma.click()
  await tel.waitForURL('**/ordine/**',{ timeout: 30_000 })
  misure.invioCasa.push(Date.now() - invio)
  const numero = Number((await tel.getByRole('heading',{ level: 1 }).textContent())!.match(/n\. (\d+)/)![1])
  daCasa.push({ numero,nome,tipo,totaleCent,inviatoAlle: Date.now() })
  log(nome,`${tipo} n. ${numero} alle ${ora} (${(totaleCent / 100).toFixed(2)} €; orari già pieni: ${pieni})`)
  return { tel,numero }
}

// ── La serata ─────────────────────────────────────────────────────────────────────────────────
test('serata simulata: sala, cucina, 6 tavoli e ordini da casa', async ({ browser }) => {
  test.skip(oraDiRoma() >= 22,'Servono orari liberi per gli ordini da casa: lanciare prima delle 22 di Roma.')
  const db = new pg.Client({ connectionString: URL_DB })
  await db.connect()
  const TAVOLI = Array.from({ length: 6 },(_,i) => ({ nome: `Tavolo ${i + 1}`,chiave: `serata${String(i + 1).padStart(6,'0')}` }))
  for (const t of TAVOLI) await db.query('insert into tavoli (nome,slug,chiave) values ($1,$2,$3)',[t.nome,t.chiave,t.chiave])
  await db.end()

  const [sala,cucinaPage] = [await tabletStaff(browser,'sala'),await tabletStaff(browser,'cucina')]
  const inSala = fila()
  const admin = await sala.context().newPage()
  await admin.goto('/admin/menu')

  // La sala apre gli ordini online di stasera.
  await sala.getByRole('button',{ name: 'Ordini online chiusi' }).click()
  const online = sala.getByRole('dialog',{ name: /^Ordini online: / })
  await online.getByRole('button',{ name: 'Apri ordini di oggi' }).click()
  await online.getByRole('button',{ name: 'Chiudi',exact: true }).click()
  log('sala','ordini online aperti')
  await scheda(sala,'Tavoli')

  const statoCucina = { fine: false,standby: false }
  const lavoroCucina = cucina(cucinaPage,statoCucina)

  const apri = (nome: string) => inSala(async () => {
    const card = sala.locator('article').filter({ has: sala.getByRole('heading',{ name: nome,exact: true }) })
    await card.getByRole('button',{ name: 'Apri tavolo' }).click()
    const codice = (await card.getByLabel(/^Codice \d{4}$/).textContent())!.trim()
    log('sala',`apre ${nome}, codice ${codice}`)
    return codice
  })
  const sblocca = (nome: string) => inSala(async () => {
    const card = sala.locator('article').filter({ has: sala.getByRole('heading',{ name: nome,exact: true }) })
    // La piastrella avvisa («N codici sbagliati»); lo sblocco è nel dettaglio del tavolo.
    const etichetta = card.getByText(/codici sbagliati$/)
    await expect(etichetta).toBeVisible({ timeout: 15_000 })
    log('sala',`vede «${(await etichetta.textContent())!.trim()}» su ${nome}`)
    await sala.getByRole('button',{ name: `Dettaglio di ${nome}` }).click()
    await sala.getByRole('complementary',{ name: `Dettaglio di ${nome}` }).getByRole('button',{ name: 'Sblocca' }).click()
    await expect(etichetta).toHaveCount(0)
    log('sala',`sblocca ${nome}`)
  })
  const chiudi = (nome: string, forza = false) => inSala(async () => {
    await sala.getByRole('button',{ name: `Dettaglio di ${nome}` }).click()
    const dettaglio = sala.getByRole('complementary',{ name: `Dettaglio di ${nome}` })
    await dettaglio.getByRole('button',{ name: 'Chiudi tavolo' }).click()
    await sala.getByRole('dialog',{ name: 'Conferma' }).getByRole('button',{ name: 'Chiudi tavolo' }).click()
    const avviso = sala.getByRole('dialog',{ name: 'Chiudi tavolo' })
    const esito = await Promise.race([sala.waitForURL('**/staff/conto/**').then(() => 'conto'),avviso.waitFor().then(() => 'avviso')])
    if (esito === 'avviso') {
      log('sala',`chiudendo ${nome}: «${(await avviso.textContent())!.replace('Chiudi tavolo','').replace(/Annulla.*$/,'').trim()}»`)
      if (!forza) problema('sala',`${nome} aveva ancora ordini in cucina al momento della chiusura`)
      await avviso.getByRole('button',{ name: 'Chiudi comunque' }).click()
      await sala.waitForURL('**/staff/conto/**')
    }
    const totale = euroInCent((await sala.getByLabel(/^Totale: /).getAttribute('aria-label'))!.match(/([\d.]+,\d{2})/)![1])
    log('sala',`chiude ${nome}: conto ${(totale / 100).toFixed(2)} €`)
    await sala.goto('/staff?vista=tavoli')
    return totale
  })
  const esaurito = (nome: string, attivo: boolean) => inSala(async () => {
    await admin.goto('/admin/menu')
    const interruttore = admin.getByRole('switch',{ name: new RegExp(`^${nome}: `) }).first()
    if ((await interruttore.getAttribute('aria-checked')) === String(attivo)) await interruttore.click()
    await expect(interruttore).toHaveAttribute('aria-checked',String(!attivo))
    log('sala',`${nome}: ${attivo ? 'ESAURITO' : 'di nuovo disponibile'}`)
  })

  const conti = new Map<string,number>()
  /** Attende che la cucina abbia servito tutte le comande di un tavolo, come farebbe il cameriere prima del conto. */
  const tuttoServito = async (nome: string) => {
    // Prima la cucina deve aver visto ogni comanda del tavolo (lo schermo si aggiorna ogni 5 s), poi averle servite tutte.
    await expect.poll(() => inviati.filter(i => i.tavolo === nome && !visteInCucina.has(String(i.numero))).length,{ timeout: 60_000 }).toBe(0)
    const comande = cucinaPage.getByRole('heading',{ name: new RegExp(`^${nome} · n\\. \\d+$`) })
    await expect(comande).toHaveCount(0,{ timeout: 240_000 })
  }

  const tavolo = async (indice: number) => {
    const { nome,chiave } = TAVOLI[indice]
    await attendi(indice * 15_000)
    const codice = await apri(nome)
    const persone = tra(2,4)
    const telefoni = await Promise.all(Array.from({ length: persone },() => apriTelefono(browser)))
    // Tavolo 3: B sbaglia il codice 5 volte; A, sulla stessa rete, prova subito dopo con il codice giusto.
    let segnalaBloccato!: () => void, segnalaSbloccato!: () => void
    const bloccato = new Promise<void>(r => { segnalaBloccato = r }), sbloccato = new Promise<void>(r => { segnalaSbloccato = r })
    await Promise.all(telefoni.map(async (tel,p) => {
      const chi = `${nome} · ${String.fromCharCode(65 + p)}`
      await attendi(tra(0,4000))
      if (indice === 2 && p === 0) {
        await bloccato
        await tel.goto(`/tavolo/${chiave}`)
        await tel.getByLabel('Codice del tavolo').fill(codice)
        await Promise.all([tel.waitForResponse(r => r.request().method() === 'POST'),tel.getByRole('button',{ name: 'Entra al tavolo' }).click()])
        await attendi(500)
        if (await avviso(tel).count()) osserva(chi,`codice GIUSTO, ma stessa rete del telefono bloccato: «${(await avviso(tel).textContent())!.trim()}»`)
        else log(chi,'entra col codice giusto nonostante il telefono bloccato')
        await sbloccato
      } else if (indice === 2 && p > 1) await sbloccato
      if (indice === 2 && p === 1) {
        // Tavolo 3: un cliente sbaglia il codice finché il telefono non viene bloccato; il cameriere sblocca.
        await tel.goto(`/tavolo/${chiave}`)
        for (let i = 0; i < 5; i++) {
          await tel.getByLabel('Codice del tavolo').fill(String((Number(codice) + 1 + i) % 10000).padStart(4,'0'))
          await Promise.all([tel.waitForResponse(r => r.request().method() === 'POST'),tel.getByRole('button',{ name: 'Entra al tavolo' }).click()])
          await expect(avviso(tel)).toBeVisible()
        }
        await tel.getByLabel('Codice del tavolo').fill(codice)
        await Promise.all([tel.waitForResponse(r => r.request().method() === 'POST'),tel.getByRole('button',{ name: 'Entra al tavolo' }).click()])
        try {
          await expect(avviso(tel)).toContainText('Troppi tentativi')
          log(chi,`5 codici sbagliati, poi quello giusto: «${(await avviso(tel).first().textContent())!.trim()}»`)
        } catch { problema(chi,'dopo 5 codici sbagliati il telefono non è stato bloccato') }
        segnalaBloccato()
        await attendi(3000)
        await sblocca(nome)
        segnalaSbloccato()
      }
      await entra(tel,chiave,codice,chi)
      const giri = tra(1,3)
      for (let g = 0; g < giri; g++) {
        let imprevisto: Imprevisto = null
        if (g === 0 && p === 0 && indice === 1) imprevisto = 'doppio-tocco'
        if (g === 0 && p === 0 && indice === 3) imprevisto = 'risposta-persa'
        if (g === 0 && p === 1 && indice === 4) imprevisto = 'offline'
        if (indice === 5 && p === 0 && g === 0) {
          // Tavolo 6: l'edamame finisce mentre è già nel carrello; il server lo toglie e il cliente rimanda il resto.
          await aggiungi(tel,['starter','Edamame'],1)
          await aggiungi(tel,['tartare','Salmone'],1)
          segnalaCarrelloConEdamame()
          await esauritoPronto
          const prima = await invia(tel,nome,chi)
          if (prima.numero !== null) problema(chi,'ordine con un piatto esaurito accettato')
          else if (!/Edamame/.test(prima.errore ?? '')) problema(chi,`messaggio inatteso per il piatto esaurito: ${prima.errore}`)
          await invia(tel,nome,chi)
          segnalaProvaEsaurito()
        } else await giro(tel,nome,chi,imprevisto)
        await attendi(tra(5000,15_000))
      }
    }))
    if (indice === 0) {
      // Tavolo 1: il conto si chiude mentre un cliente ha ancora il carrello pieno.
      const ritardatario = telefoni[0]
      await aggiungi(ritardatario,['dessert','Tiramisù'],1)
      await tuttoServito(nome)
      conti.set(nome,await chiudi(nome))
      const esito = await invia(ritardatario,nome,`${nome} · A`)
      if (esito.numero !== null) problema(`${nome} · A`,'ordine accettato a tavolo chiuso')
    } else {
      await tuttoServito(nome)
      conti.set(nome,await chiudi(nome))
    }
    await Promise.all(telefoni.map(t => t.context().close()))
  }

  let segnalaEsaurito!: () => void, segnalaProvaEsaurito!: () => void, segnalaCarrelloConEdamame!: () => void
  const esauritoPronto = new Promise<void>(r => { segnalaEsaurito = r })
  const carrelloConEdamame = new Promise<void>(r => { segnalaCarrelloConEdamame = r })
  const provaEsauritoFatta = new Promise<void>(r => { segnalaProvaEsaurito = r })
  const imprevistiSala = (async () => {
    await carrelloConEdamame
    await esaurito('Edamame',true)
    segnalaEsaurito()
    await provaEsauritoFatta
    await esaurito('Edamame',false)
  })()

  const clienti = (async () => {
    const lista: [string,string,'asporto' | 'domicilio',[string,string][]][] = [
      ['Anna Rossi','3330000001','asporto',[['special-roll','Sake roll'],['nigiri','Salmone']]],
      ['Marco Bianchi','3330000002','domicilio',[['poke-bowl','Daniel\'s poke'],['beverage','Coca Cola']]],
      [RIFIUTA,'3330000003','asporto',[['primi','Ramen']]],
      ['Giulia Verdi','3330000004','domicilio',[['special-roll','Rainbow roll'],['tartare','Tonno']]],
      ['Luca Neri','3330000005','asporto',[['sushi-gio','Gio salmone'],['hosomaki','Tonno']]],
    ]
    const aperti: { tel: Page; numero: number; nome: string }[] = []
    for (const [i,[nome,telefono,tipo,piatti]] of lista.entries()) {
      await attendi(i === 0 ? 20_000 : 25_000)
      if (i === 3) {
        // Il tablet della cucina va in standby per 40 secondi proprio mentre arriva un ordine da casa.
        statoCucina.standby = true
        standby.push({ da: Date.now(),a: null })
        await cucinaPage.evaluate(() => { Object.defineProperty(document,'visibilityState',{ value: 'hidden',configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
        log('cucina','tablet in standby (schermo nascosto)')
        const o = await clienteDaCasa(browser,nome,telefono,tipo,piatti)
        aperti.push({ ...o,nome })
        await attendi(40_000)
        const visto = await cucinaPage.getByRole('heading',{ name: new RegExp(`· n\\. ${o.numero}$`) }).count()
        log('cucina',`dopo 40 s di standby l’ordine n. ${o.numero} ${visto ? 'è già sullo schermo' : 'non è sullo schermo (atteso: lo schermo nascosto non si aggiorna)'}`)
        const risveglio = Date.now()
        await cucinaPage.evaluate(() => { Object.defineProperty(document,'visibilityState',{ value: 'visible',configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
        await expect(cucinaPage.getByRole('heading',{ name: new RegExp(`· n\\. ${o.numero}$`) })).toBeVisible({ timeout: 20_000 })
        log('cucina',`al risveglio l’ordine n. ${o.numero} compare in ${((Date.now() - risveglio) / 1000).toFixed(1)} s`)
        statoCucina.standby = false
        standby[standby.length - 1].a = Date.now()
      } else aperti.push({ ...(await clienteDaCasa(browser,nome,telefono,tipo,piatti)),nome })
    }
    // I clienti seguono l'ordine dalla pagina di stato (si aggiorna da sola).
    for (const { tel,numero,nome } of aperti) {
      const atteso = nome === RIFIUTA ? /Rifiutato/ : /Confermato|In preparazione|Pronto|In consegna|Consegnato|Ritirato/
      try {
        await expect(tel.getByRole('status').filter({ hasText: atteso }).first()).toBeVisible({ timeout: 60_000 })
        log(nome,`la pagina dell’ordine n. ${numero} dice: «${(await tel.getByRole('status').first().textContent())!.trim().slice(0,60)}»`)
      } catch { problema(nome,`la pagina dell’ordine n. ${numero} non si è aggiornata entro 60 s`) }
    }
    return aperti
  })()

  await Promise.all([...TAVOLI.map((_,i) => tavolo(i)),imprevistiSala])
  const aperti = await clienti
  // La cucina finisce le comande da casa, poi si chiude il turno.
  await expect(cucinaPage.getByRole('heading',{ name: /· n\. \d+$/ })).toHaveCount(0,{ timeout: 240_000 })
  statoCucina.fine = true
  await lavoroCucina
  for (const { tel } of aperti) await tel.context().close()

  // ── Controlli sul database ──────────────────────────────────────────────────────────────────
  const verifica = new pg.Client({ connectionString: URL_DB })
  await verifica.connect()
  const { rows: ordini } = await verifica.query<{ numero: number; tavolo: string | null; tipo: string; stato: string; totale: number; somma: number; chiavi: number }>(`
    select o.numero,t.nome as tavolo,o.tipo,o.stato,o.totale_cent as totale,
      (select coalesce(sum(prezzo_unit_cent*quantita),0)::int from righe_ordine r where r.ordine_id=o.id and not r.annullata) + coalesce(o.consegna_cent,0) as somma,
      (select count(*)::int from ordini x where x.chiave_invio=o.chiave_invio) as chiavi
    from ordini o left join sessioni_tavolo s on s.id=o.sessione_id left join tavoli t on t.id=s.tavolo_id
    where t.nome like 'Tavolo %' and t.nome <> 'Tavolo prova' or o.tipo <> 'tavolo' order by o.numero`)
  const sessioniAperte = (await verifica.query(`select count(*)::int as n from sessioni_tavolo s join tavoli t on t.id=s.tavolo_id where t.nome like 'Tavolo _' and s.chiusa_il is null`)).rows[0].n
  await verifica.end()

  const tavolo_ = ordini.filter(o => o.tipo === 'tavolo')
  if (tavolo_.length !== inviati.length) problema('controlli',`ordini al tavolo: ${tavolo_.length} nel database, ${inviati.length} confermati ai clienti`)
  for (const i of inviati) {
    const o = tavolo_.find(x => x.numero === i.numero)
    if (!o) problema('controlli',`ordine n. ${i.numero} confermato al cliente ma assente nel database`)
    else if (o.totale !== i.totaleCent) problema('controlli',`ordine n. ${i.numero}: ${o.totale} cent nel database, ${i.totaleCent} visti dal cliente`)
  }
  for (const o of ordini) {
    if (o.totale !== o.somma) problema('controlli',`ordine n. ${o.numero}: totale ${o.totale} diverso dalla somma delle righe ${o.somma}`)
    if (o.chiavi !== 1) problema('controlli',`ordine n. ${o.numero}: chiave d’invio usata ${o.chiavi} volte`)
    if (o.tipo === 'tavolo' && o.stato !== 'servito') problema('controlli',`ordine n. ${o.numero} del ${o.tavolo} rimasto «${o.stato}»`)
  }
  for (const [nome,totale] of conti) {
    const atteso = inviati.filter(i => i.tavolo === nome).reduce((s,i) => s + i.totaleCent,0)
    if (totale !== atteso) problema('controlli',`${nome}: conto ${totale} cent, ordini confermati ai clienti ${atteso} cent`)
  }
  if (sessioniAperte !== 0) problema('controlli',`${sessioniAperte} tavoli ancora aperti`)
  if (daCasa.length !== ordini.filter(o => o.tipo !== 'tavolo').length) problema('controlli','numero di ordini da casa diverso tra clienti e database')

  const statistiche = (xs: number[]) => {
    const s = [...xs].sort((a,b) => a - b)
    return s.length ? { n: s.length,mediana: s[Math.floor(s.length / 2)],p95: s[Math.min(s.length - 1,Math.floor(s.length * 0.95))],massimo: s[s.length - 1] } : null
  }
  mkdirSync('test-results/serata',{ recursive: true })
  const risultati = {
    durataSecondi: secondi(),tavoli: TAVOLI.length,ordiniTavolo: inviati.length,ordiniCasa: daCasa.length,conti: Object.fromEntries(conti),
    tempiMs: Object.fromEntries(Object.entries(misure).map(([k,v]) => [k,statistiche(v)])),
    ordini,problemi,osservazioni,richiesteLente: lente,eventi,
  }
  writeFileSync('test-results/serata/risultati.json',JSON.stringify(risultati,null,2),'utf8')
  log('controlli',`fine: ${inviati.length} ordini al tavolo, ${daCasa.length} da casa, ${problemi.length} problemi`)
  expect(problemi).toEqual([])
})
