import { expect, test } from '@playwright/test'
import { apriSchermoStaff, apriTelefono, cardOrdine, oraDiRoma, sposta } from './aiuti'

test('da casa: ordine a domicilio, accettato +15’, seguito dal cliente fino alla consegna', async ({ browser }) => {
  test.skip(oraDiRoma() >= 23,'Dopo le 23:00 di Roma non restano fasce di oggi: le fasce non attraversano la mezzanotte.')
  const staff = await apriSchermoStaff(browser)
  // Gli ordini online si aprono dal pannello della barra, che poi si chiude.
  await staff.getByRole('button',{ name: 'Ordini online chiusi' }).click()
  const online = staff.getByRole('dialog',{ name: /^Ordini online: / })
  await online.getByRole('button',{ name: 'Apri ordini di oggi' }).click()
  await expect(online.getByRole('heading',{ name: 'Ordini online: aperti oggi' })).toBeVisible()
  await online.getByRole('button',{ name: 'Chiudi',exact: true }).click()
  await expect(staff.getByRole('button',{ name: 'Ordini online aperti' })).toBeVisible()

  // Il cliente sceglie dal menù: 3 tartare di salmone (18,00 €), sopra il minimo di 15,00 € della zona.
  const cliente = await apriTelefono(browser)
  await cliente.goto('/')
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aggiungi Salmone',exact: true }).click()
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await cliente.locator('#tartare').getByRole('button',{ name: 'Aumenta Salmone',exact: true }).click()
  await cliente.getByRole('button',{ name: /^Vedi il carrello · 3 piatti/ }).click()
  await cliente.getByRole('button',{ name: 'Vai al riepilogo' }).click()
  await cliente.waitForURL('**/ordina')

  await cliente.getByLabel('Consegna a domicilio').check()
  await cliente.getByLabel('Zona').selectOption({ label: 'Centro · consegna 2,00 € · minimo 15,00 €' })
  await cliente.getByLabel('Indirizzo e numero civico').fill('Via Roma 1')
  // Primo orario libero: il testo dell'etichetta è l'ora mostrata anche allo staff.
  const orario = cliente.getByRole('radiogroup',{ name: 'Consegna verso le' }).locator('label').filter({ has: cliente.getByRole('radio',{ disabled: false }) }).first()
  const prima = (await orario.textContent())!.trim()
  await orario.click()
  await expect(orario.getByRole('radio')).toBeChecked()
  await cliente.getByLabel('Nome').fill('Anna Prova')
  await cliente.getByLabel('Telefono').fill('3331234567')
  await cliente.getByLabel('Email (per la conferma)').fill('anna@esempio.it')
  await cliente.getByLabel('Carta (POS)').check()
  await cliente.getByLabel(/informativa privacy/).check()
  await cliente.getByRole('button',{ name: 'Conferma l’ordine · 20,00 €' }).click()
  await cliente.waitForURL('**/ordine/**')
  await expect(cliente.getByRole('status').filter({ hasText: 'In attesa di conferma' })).toBeVisible()
  const numero = (await cliente.getByRole('heading',{ level: 1 }).textContent())!.match(/n\. (\d+)/)![1]

  // Lo staff accetta con 15 minuti in più.
  const daAccettare = cardOrdine(staff,`Domicilio ${prima} · n. ${numero}`)
  await daAccettare.getByRole('button',{ name: 'Accetta +15’' }).click()
  const spostato = sposta(prima,15)
  const card = cardOrdine(staff,`Domicilio ${spostato} · n. ${numero}`)
  await expect(card).toBeVisible()

  // La pagina del cliente si aggiorna da sola (ogni 10 s) con lo stato e l'orario nuovo.
  await expect(cliente.getByRole('status').filter({ hasText: 'Confermato' })).toBeVisible({ timeout: 15_000 })
  await expect(cliente.getByText(spostato).first()).toBeVisible()

  for (const passo of ['Inizia a preparare','Segna pronto','Segna partito','Segna consegnato']) await card.getByRole('button',{ name: passo }).click()
  await expect(card).toHaveCount(0)
  await cliente.reload()
  await expect(cliente.getByRole('status').filter({ hasText: 'Consegnato' })).toBeVisible()
})
