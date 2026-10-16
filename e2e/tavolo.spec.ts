import { expect, test } from '@playwright/test'
import { apriSchermoStaff, apriTelefono, cardOrdine, scheda } from './aiuti'
import { TAVOLO_E2E } from './dati'

test('tavolo: QR, codice, ordini da due telefoni, comanda del cameriere, cucina e chiusura del conto', async ({ browser }) => {
  const staff = await apriSchermoStaff(browser)
  await scheda(staff,'Tavoli')
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
    await expect(telefono.getByRole('button',{ name: /^Rivedi e manda in cucina · / })).toBeVisible()
  }

  // Anna: una tartare di salmone (6,00 €).
  await anna.locator('#sez-tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await anna.getByRole('button',{ name: /^Rivedi e manda in cucina · 1 piatti/ }).click()
  await anna.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoAnna = anna.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoAnna).toBeVisible()
  const numeroAnna = (await inviatoAnna.textContent())!.match(/n\. (\d+)/)![1]

  // Bruno: una poke composta (base + una proteina, 9,00 €).
  await bruno.getByRole('button',{ name: 'Componi la tua poke' }).click()
  const poke = bruno.getByRole('dialog',{ name: 'Componi poke' })
  // Un gruppo per passo: base, proteine, poi avanti (gli altri gruppi sono facoltativi) fino ad «Aggiungi al carrello».
  await poke.getByLabel('Riso bianco').check()
  await poke.getByRole('button',{ name: /^Avanti: Proteine/ }).click()
  await poke.getByLabel('Salmone crudo').check()
  const aggiungi = poke.getByRole('button',{ name: 'Aggiungi al carrello' })
  while (!await aggiungi.isVisible()) await poke.getByRole('button',{ name: /^Avanti: / }).click()
  await aggiungi.click()
  // Una seconda poke riparte dalla base, senza le scelte di quella appena aggiunta.
  await bruno.getByRole('button',{ name: 'Componi la tua poke' }).click()
  await expect(poke.getByText('Passo 1 di',{ exact: false })).toBeVisible()
  await expect(poke.getByLabel('Riso bianco')).not.toBeChecked()
  await poke.getByRole('button',{ name: 'Chiudi' }).click()
  await bruno.getByRole('button',{ name: /^Rivedi e manda in cucina · 1 piatti/ }).click()
  await bruno.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoBruno = bruno.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoBruno).toBeVisible()
  const numeroBruno = (await inviatoBruno.textContent())!.match(/n\. (\d+)/)![1]

  // Lo staff vede i due ordini nella scheda Ordini (aggiornamento ogni 5 s) e li porta a «servito».
  await scheda(staff,'Ordini')
  for (const numero of [numeroAnna,numeroBruno]) {
    const card = cardOrdine(staff,`${TAVOLO_E2E.nome} · n. ${numero}`)
    await card.getByRole('button',{ name: 'Inizia a preparare' }).click()
    await card.getByRole('button',{ name: 'Segna servito' }).click()
    await expect(card).toHaveCount(0)
  }
  await scheda(staff,'Tavoli')
  await expect(tavolo).toContainText('2 ordini · 15,00 €')

  // Comanda del cameriere: dal dettaglio del tavolo, senza codice, una tartare (6,00 €) per il tavolo.
  await tavolo.getByRole('button',{ name: `Dettaglio di ${TAVOLO_E2E.nome}` }).click()
  const dettaglio = staff.getByRole('complementary',{ name: `Dettaglio di ${TAVOLO_E2E.nome}` })
  await dettaglio.getByRole('link',{ name: 'Ordina per il tavolo' }).click()
  await staff.waitForURL('**/staff/tavolo/**/ordina')
  // Il cameriere ordina dal proprio telefono: la pagina si prova a 375 px.
  await staff.setViewportSize({ width: 375,height: 812 })
  await expect(staff.getByRole('heading',{ name: `Ordine per ${TAVOLO_E2E.nome}` })).toBeVisible()
  await expect(staff.getByLabel(`Codice ${codice}`)).toBeVisible()
  await staff.locator('#sez-tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await staff.getByRole('button',{ name: /^Rivedi e manda in cucina · 1 piatti/ }).click()
  await staff.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviatoCameriere = staff.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviatoCameriere).toBeVisible()
  const numeroCameriere = (await inviatoCameriere.textContent())!.match(/n\. (\d+)/)![1]
  await expect(staff.getByRole('region',{ name: 'Ordinato finora' }).getByText('Dal cameriere',{ exact: true })).toBeVisible()
  if (process.env.E2E_SCHERMATE) await staff.screenshot({ path: `${process.env.E2E_SCHERMATE}/comanda-cameriere-375.png`,fullPage: true })
  await staff.setViewportSize({ width: 1280,height: 900 })
  // Il telefono di Anna (aggiornamento ogni 10 s) vede la comanda del cameriere con il suo chip.
  const ordineCameriere = anna.locator('article').filter({ has: anna.getByRole('heading',{ name: `Ordine n. ${numeroCameriere}` }) })
  await expect(ordineCameriere).toBeVisible({ timeout: 30_000 })
  await expect(ordineCameriere.getByText('Dal cameriere')).toBeVisible()
  await expect(anna.getByText('21,00 €')).toBeVisible()
  // In cucina la comanda è segnata «Dal cameriere» e si serve come le altre.
  await staff.goto('/staff?vista=ordini')
  const cardCameriere = cardOrdine(staff,`${TAVOLO_E2E.nome} · n. ${numeroCameriere}`)
  await expect(cardCameriere.getByText('Dal cameriere')).toBeVisible()
  await cardCameriere.getByRole('button',{ name: 'Inizia a preparare' }).click()
  await cardCameriere.getByRole('button',{ name: 'Segna servito' }).click()
  await expect(cardCameriere).toHaveCount(0)

  // Chiusura del tavolo dal dettaglio: si passa al conto, con il totale che comprende la comanda del cameriere.
  await scheda(staff,'Tavoli')
  await expect(tavolo).toContainText('3 ordini · 21,00 €')
  await tavolo.getByRole('button',{ name: `Dettaglio di ${TAVOLO_E2E.nome}` }).click()
  await expect(dettaglio.getByRole('link',{ name: 'Apri il conto' })).toBeVisible()
  await dettaglio.getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.getByRole('dialog',{ name: 'Conferma' }).getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await staff.waitForURL('**/staff/conto/**')
  await expect(staff.getByText('21,00 €').first()).toBeVisible()

  // Un nuovo telefono con il vecchio codice resta fuori.
  const carlo = await apriTelefono(browser)
  await carlo.goto(`/tavolo/${TAVOLO_E2E.chiave}`)
  await carlo.getByLabel('Codice del tavolo').fill(codice)
  await carlo.getByRole('button',{ name: 'Entra al tavolo' }).click()
  await expect(carlo.getByRole('alert').filter({ hasText: 'Il tavolo non è ancora aperto' })).toBeVisible()
  await expect(carlo.getByRole('button',{ name: /^Rivedi e manda in cucina · / })).toHaveCount(0)
})
