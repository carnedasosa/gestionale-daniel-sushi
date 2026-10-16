import { expect, type Browser, type Page } from '@playwright/test'

export type PostazioneStaff = 'cassa' | 'banco' | 'cucina' | 'sala'
/** Login dell'utente di prova (E2E_EMAIL/E2E_PASSWORD in .env.local) e schermo staff della postazione con il turno iniziato. */
export async function apriSchermoStaff(browser: Browser, postazione: PostazioneStaff = 'cassa', viewport = { width: 1280,height: 900 }, opzioni: { hasTouch?: boolean } = {}): Promise<Page> {
  const { E2E_EMAIL: email,E2E_PASSWORD: password } = process.env
  if (!email || !password) throw new Error('Servono E2E_EMAIL ed E2E_PASSWORD in .env.local')
  const page = await (await browser.newContext({ viewport,...opzioni })).newPage()
  await page.goto('/accesso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button',{ name: 'Entra' }).click()
  await page.waitForURL('**/admin')
  await iniziaTurno(page,postazione)
  return page
}

/** Apre /staff con la postazione e tocca «Inizia turno», che la salva nel cookie del dispositivo. */
export async function iniziaTurno(page: Page, postazione: PostazioneStaff = 'cassa', vista?: string) {
  await page.goto(`/staff?postazione=${postazione}${vista ? `&vista=${vista}` : ''}`)
  await expect(page.getByRole('radio',{ name: { cassa: 'Cassa',banco: 'Banco sushi',cucina: 'Cucina',sala: 'Sala' }[postazione] })).toBeChecked()
  await page.getByRole('button',{ name: 'Inizia turno' }).click()
  await expect.poll(async () => (await page.context().cookies()).find(c => c.name === 'ds_postazione')?.value).toBe(postazione)
  if (!vista) await expect(page.getByRole('heading',{ name: /^Da preparare/ })).toBeVisible()
}

/** Passa a una scheda dello schermo staff (Ordini, Tavoli, Conti): le altre restano montate ma nascoste. */
export async function scheda(staff: Page, nome: 'Ordini' | 'Tavoli' | 'Conti') {
  await staff.getByRole('navigation',{ name: 'Sezioni dello staff' }).getByRole('link',{ name: nome }).click()
  await staff.waitForURL(`**/staff?vista=${nome.toLowerCase()}`)
  await expect(staff.getByRole('region',{ name: nome,exact: true })).toBeVisible()
}

/** Telefono del cliente: viewport da 375×812 con touch. */
export async function apriTelefono(browser: Browser): Promise<Page> {
  return (await browser.newContext({ viewport: { width: 375,height: 812 },hasTouch: true,isMobile: true })).newPage()
}

/** Card di un ordine nello schermo staff, trovata dal titolo (es. «Tavolo prova · n. 4»). */
export function cardOrdine(staff: Page, titolo: string | RegExp) {
  return staff.locator('article').filter({ has: staff.getByRole('heading',{ name: titolo }) })
}

/** Ora di Roma (0–23), per saltare le prove da casa vicino alla mezzanotte. */
export function oraDiRoma(): number {
  return Number(new Intl.DateTimeFormat('it-IT',{ hour: '2-digit',hourCycle: 'h23',timeZone: 'Europe/Rome' }).format(new Date()))
}

/** «HH:MM» spostato di `minuti` (le fasce non attraversano la mezzanotte). */
export function sposta(ora: string, minuti: number): string {
  const [h,m] = ora.split(':').map(Number)
  const totale = h * 60 + m + minuti
  return `${String(Math.floor(totale / 60)).padStart(2,'0')}:${String(totale % 60).padStart(2,'0')}`
}
