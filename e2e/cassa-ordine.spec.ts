import { expect, test } from '@playwright/test'
import { apriSchermoStaff, cardOrdine, oraDiRoma } from './aiuti'

// Il database di prova è condiviso con le altre prove: l'interruttore degli ordini online può essere acceso o spento, per la cassa non conta.
test('dalla cassa: ordine telefonico d’asporto, in cucina già accettato', async ({ browser }) => {
  test.skip(oraDiRoma() >= 23,'Dopo le 23:00 di Roma non restano fasce di oggi: le fasce non attraversano la mezzanotte.')
  const staff = await apriSchermoStaff(browser)
  await staff.getByRole('link',{ name: 'Nuovo ordine' }).click()
  await staff.waitForURL('**/staff/nuovo-ordine')

  // 3 tartare di salmone (18,00 €), poi i dati del cliente.
  await staff.locator('#sez-tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await staff.locator('#sez-tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await staff.locator('#sez-tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await staff.getByRole('button',{ name: /^Rivedi l’ordine · 3 piatti/ }).click()
  await staff.getByRole('dialog',{ name: 'Il tuo carrello' }).getByRole('button',{ name: 'Dati del cliente' }).click()
  const modulo = staff.getByRole('dialog',{ name: 'Dati del cliente' })
  await expect(modulo.getByLabel('Ritiro al locale (asporto)')).toBeChecked()
  // Primo orario libero: sotto l'ora c'è l'occupazione «0/4».
  const orario = modulo.getByRole('radiogroup',{ name: 'Ritiro alle' }).locator('label').filter({ has: staff.getByRole('radio',{ disabled: false }) }).first()
  const ora = (await orario.locator('.b-num').first().textContent())!.trim()
  await expect(orario).toContainText('0/4')
  await orario.click()
  await modulo.getByLabel('Nome').fill('Carlo al telefono')
  await modulo.getByLabel('Telefono').fill('333 987 6543')
  await modulo.getByLabel('Carta (POS)').check()
  await modulo.getByRole('button',{ name: 'Manda in cucina · 18,00 €' }).click()
  const fatto = staff.getByRole('status').filter({ hasText: 'in cucina' })
  await expect(fatto).toBeVisible()
  const numero = (await fatto.textContent())!.match(/n\. (\d+)/)![1]
  await staff.getByRole('link',{ name: 'Torna allo schermo' }).click()
  await staff.waitForURL('**/staff')

  // Già accettato: non passa da «Da accettare», ha il chip della cassa e si porta fino al ritiro.
  const card = cardOrdine(staff,`Asporto ${ora} · n. ${numero}`)
  await expect(card).toBeVisible()
  await expect(card).toContainText('Dalla cassa')
  await expect(card).toContainText('Carlo al telefono')
  await expect(staff.getByRole('region',{ name: /^Da accettare/ }).locator('article')).toHaveCount(0)
  for (const passo of ['Inizia a preparare','Segna pronto','Segna ritirato']) await card.getByRole('button',{ name: passo }).click()
  await expect(card).toHaveCount(0)
})
