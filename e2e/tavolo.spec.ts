import { expect, test } from '@playwright/test'
import { apriSchermoStaff, apriTelefono, cardOrdine } from './aiuti'
import { TAVOLO_E2E } from './dati'

test('tavolo: QR, codice, ordini da due telefoni, cucina e chiusura del conto', async ({ browser }) => {
  const staff = await apriSchermoStaff(browser)
  const tavolo = staff.locator('article').filter({ has: staff.getByRole('heading',{ name: TAVOLO_E2E.nome,exact: true }) })
  await tavolo.getByRole('button',{ name: 'Apri tavolo' }).click()
  const codice = (await tavolo.getByLabel(/^Codice \d{4}$/).textContent())!.trim()
  expect(codice).toMatch(/^\d{4}$/)

  // Due telefoni entrano dal link del QR con il codice del cameriere.
  const [anna,bruno] = [await apriTelefono(browser),await apriTelefono(browser)]
  for (const telefono of [anna,bruno]) {
    await telefono.goto(`/tavolo/${TAVOLO_E2E.chiave}`)
    await telefono.getByLabel('Codice del tavolo').fill(codice)
    await telefono.getByRole('button',{ name: 'Entra al tavolo' }).click()
    await expect(telefono.getByRole('button',{ name: /^Carrello · / })).toBeVisible()
  }

  // Anna: una tartare di salmone (6,00 €).
  await anna.locator('#tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await anna.getByRole('button',{ name: /^Carrello · 1 piatti/ }).click()
  await anna.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoAnna = anna.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoAnna).toBeVisible()
  const numeroAnna = (await inviatoAnna.textContent())!.match(/n\. (\d+)/)![1]

  // Bruno: una poke composta (base + una proteina, 9,00 €).
  await bruno.getByRole('button',{ name: 'Componi la tua poke' }).click()
  const poke = bruno.getByRole('dialog',{ name: 'Componi poke' })
  await poke.getByLabel('Riso bianco').check()
  await poke.getByLabel('Salmone crudo').check()
  await poke.getByRole('button',{ name: 'Aggiungi al carrello' }).click()
  await bruno.getByRole('button',{ name: /^Carrello · 1 piatti/ }).click()
  await bruno.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoBruno = bruno.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoBruno).toBeVisible()
  const numeroBruno = (await inviatoBruno.textContent())!.match(/n\. (\d+)/)![1]

  // Lo staff vede i due ordini (aggiornamento ogni 5 s) e li porta a «servito».
  for (const numero of [numeroAnna,numeroBruno]) {
    const card = cardOrdine(staff,`${TAVOLO_E2E.nome} · n. ${numero}`)
    await card.getByRole('button',{ name: 'In preparazione' }).click()
    await card.getByRole('button',{ name: 'Servito' }).click()
    await expect(card).toHaveCount(0)
  }
  await expect(tavolo).toContainText('2 ordini · 15,00 €')

  // Chiusura del tavolo: si passa al conto.
  await tavolo.getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.getByRole('dialog',{ name: 'Conferma' }).getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.waitForURL('**/staff/conto/**')
  await expect(staff.getByText('15,00 €').first()).toBeVisible()

  // Un nuovo telefono con il vecchio codice resta fuori.
  const carlo = await apriTelefono(browser)
  await carlo.goto(`/tavolo/${TAVOLO_E2E.chiave}`)
  await carlo.getByLabel('Codice del tavolo').fill(codice)
  await carlo.getByRole('button',{ name: 'Entra al tavolo' }).click()
  await expect(carlo.getByRole('alert').filter({ hasText: 'Il tavolo non è ancora aperto' })).toBeVisible()
  await expect(carlo.getByRole('button',{ name: /^Carrello · / })).toHaveCount(0)
})
