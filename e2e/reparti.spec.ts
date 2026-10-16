import { expect, test } from '@playwright/test'
import pg from 'pg'
import { apriSchermoStaff, apriTelefono, cardOrdine, scheda } from './aiuti'
import { URL_DB } from './dati'

// Un tavolo tutto suo: il database di prova è condiviso con le altre prove.
const TAVOLO = { nome: 'Tavolo reparti',chiave: 'reparti00001' }

test('reparti: banco e cucina vedono solo la loro parte, la sala porta bibite e piatti, il conto torna', async ({ browser }) => {
  const db = new pg.Client({ connectionString: URL_DB })
  await db.connect()
  await db.query('insert into tavoli (nome,slug,chiave) values ($1,$2,$3) on conflict do nothing',[TAVOLO.nome,'tavolo-reparti',TAVOLO.chiave])
  await db.end()

  // Tre dispositivi: la cassa, il tablet del banco sushi, quello della cucina.
  const cassa = await apriSchermoStaff(browser,'cassa')
  const banco = await apriSchermoStaff(browser,'banco')
  const cucina = await apriSchermoStaff(browser,'cucina')
  await expect(banco.getByText('Staff · Banco sushi')).toBeVisible()
  await expect(banco.getByRole('link',{ name: 'Tavoli' })).toHaveCount(0)
  await expect(banco.getByRole('heading',{ name: /^Da accettare/ })).toHaveCount(0)

  await scheda(cassa,'Tavoli')
  const tavolo = cassa.locator('article').filter({ has: cassa.getByRole('heading',{ name: TAVOLO.nome,exact: true }) })
  await tavolo.getByRole('button',{ name: 'Apri tavolo' }).click()
  const codice = (await tavolo.getByLabel(/^Codice \d{4}$/).textContent())!.trim()

  // Il cliente ordina tartare di salmone (6,00 €), tiramisù (5,00 €) e Coca Cola (2,00 €).
  const tel = await apriTelefono(browser)
  await tel.goto(`/tavolo/${TAVOLO.chiave}`)
  await tel.getByLabel('Codice del tavolo').fill(codice)
  await tel.getByRole('button',{ name: 'Entra al tavolo' }).click()
  for (const [sezione,nome] of [['tartare','Salmone'],['dessert','Tiramisù'],['beverage','Coca Cola']]) await tel.locator(`#sez-${sezione}`).getByRole('button',{ name: `Aggiungi ${nome}`,exact: true }).click()
  await tel.getByRole('button',{ name: /^Rivedi e manda in cucina · 3 piatti/ }).click()
  await tel.getByRole('button',{ name: 'Invia ordine' }).click()
  const inviato = tel.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })
  await expect(inviato).toBeVisible()
  const numero = (await inviato.textContent())!.match(/n\. (\d+)/)![1]
  const titolo = `${TAVOLO.nome} · n. ${numero}`

  // Il banco vede solo la tartare, la cucina solo il dolce; la bibita non va a nessuno dei due.
  const alBanco = cardOrdine(banco,titolo), inCucina = cardOrdine(cucina,titolo)
  await expect(alBanco).toBeVisible()
  await expect(alBanco).toContainText('Salmone'); await expect(alBanco).not.toContainText('Tiramisù'); await expect(alBanco).not.toContainText('Coca Cola')
  await expect(alBanco).toContainText('+ 1 piatto in cucina')
  await expect(inCucina).toBeVisible()
  await expect(inCucina).toContainText('Tiramisù'); await expect(inCucina).not.toContainText('Salmone')

  // La cassa vede l'ordine intero con i reparti e la bibita da portare.
  await scheda(cassa,'Ordini')
  const allaCassa = cardOrdine(cassa,titolo)
  await expect(allaCassa).toContainText('Banco sushi: da preparare')
  const striscia = cassa.getByRole('region',{ name: /^Da portare al tavolo/ })
  await expect(striscia).toContainText('1× Coca Cola')

  // Il banco prepara e segna pronta: l'ordine è in preparazione, la tartare è da portare.
  await alBanco.getByRole('button',{ name: 'Inizia a preparare' }).click()
  await alBanco.getByRole('button',{ name: 'Segna pronta' }).click()
  await expect(alBanco.getByRole('button')).toHaveCount(0)
  await expect(cassa.getByRole('region',{ name: /^In preparazione/ }).getByRole('heading',{ name: titolo })).toBeVisible()
  await expect(allaCassa).toContainText('Banco sushi: pronta')
  await expect(striscia).toContainText('Banco sushi, pronto')

  // La cucina finisce il dolce; la sala porta la bibita: l'ordine è servito e sparisce da tutti gli schermi.
  await inCucina.getByRole('button',{ name: 'Inizia a preparare' }).click()
  await inCucina.getByRole('button',{ name: 'Segna pronta' }).click()
  await striscia.getByRole('button',{ name: `Portate · ${TAVOLO.nome} n. ${numero} · Bevande` }).click()
  await expect(allaCassa).toHaveCount(0)
  await expect(alBanco).toHaveCount(0)
  await expect(inCucina).toHaveCount(0)
  // I piatti pronti restano da portare finché la sala non li porta.
  for (const cosa of ['Banco sushi, pronto','Cucina, pronto']) await striscia.getByRole('button',{ name: `Portate · ${TAVOLO.nome} n. ${numero} · ${cosa}` }).click()
  await expect(striscia).toHaveCount(0)

  // Il conto ha le tre voci, 13,00 €.
  await scheda(cassa,'Tavoli')
  await tavolo.getByRole('button',{ name: `Dettaglio di ${TAVOLO.nome}` }).click()
  const dettaglio = cassa.getByRole('complementary',{ name: `Dettaglio di ${TAVOLO.nome}` })
  await dettaglio.getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await cassa.getByRole('dialog',{ name: 'Conferma' }).getByRole('button',{ name: 'Chiudi tavolo' }).click()
  await cassa.waitForURL('**/staff/conto/**')
  await expect(cassa.getByRole('table',{ name: 'Voci del conto' }).locator('tbody tr')).toHaveCount(3)
  await expect(cassa.getByLabel('Totale: 13,00 €')).toBeVisible()

  // La postazione resta sul dispositivo: il banco, ricaricato senza ?postazione=, è ancora il banco.
  await banco.goto('/staff')
  await expect(banco.getByText('Staff · Banco sushi')).toBeVisible()
})
