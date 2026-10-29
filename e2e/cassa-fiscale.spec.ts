import { expect, test } from '@playwright/test'
import pg from 'pg'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { apriSchermoStaff, apriTelefono, scheda } from './aiuti'
import { PORTA_APP, STAMPA_TOKEN_E2E, URL_DB } from './dati'
import { giro } from '../scripts/ponte-stampa/trasporto'

// Un tavolo tutto suo: il database di prova è condiviso con le altre prove.
const TAVOLO = { nome: 'Tavolo cassa',chiave: 'cassa0000001' }
// Con E2E_FOTO=1 salva le schermate in test-results/foto (controllo a occhio di conto, incasso e carta dei vini).
const foto = async (p: import('@playwright/test').Page, nome: string) => { if (process.env.E2E_FOTO) await p.screenshot({ path: `test-results/foto/${nome}.png`,fullPage: true }) }

test('cassa: coperti, comande su carta col ponte, pre-conto, romana con scontrini, chiusura; un vino nel menù', async ({ browser }) => {
  const db = new pg.Client({ connectionString: URL_DB })
  await db.connect()
  const cartella = mkdtempSync(path.join(tmpdir(),'ponte-e2e-'))
  // Il ponte vero, in modalità prova: scrive su file invece di stampare.
  const ponte = () => giro({ server: `http://127.0.0.1:${PORTA_APP}`,token: STAMPA_TOKEN_E2E,stampanti: {},prova: cartella })
  try {
    await db.query('insert into tavoli (nome,slug,chiave) values ($1,$2,$3) on conflict do nothing',[TAVOLO.nome,'tavolo-cassa',TAVOLO.chiave])
    await db.query('update impostazioni_cassa set coperto_cent=200,stampa_banco=true,stampa_cucina=true,scontrino_automatico=true')

    const cassa = await apriSchermoStaff(browser,'cassa')
    await scheda(cassa,'Tavoli')
    const tile = cassa.locator('article').filter({ has: cassa.getByRole('heading',{ name: TAVOLO.nome,exact: true }) })
    await tile.getByRole('button',{ name: 'Apri tavolo' }).click()
    const codice = (await tile.getByLabel(/^Codice \d{4}$/).textContent())!.trim()
    await tile.getByRole('button',{ name: `Dettaglio di ${TAVOLO.nome}` }).click()
    const dettaglio = cassa.getByRole('complementary',{ name: `Dettaglio di ${TAVOLO.nome}` })
    for (let i = 0; i < 2; i++) await dettaglio.getByRole('button',{ name: 'Un coperto in più' }).click()
    await expect(dettaglio.getByRole('group',{ name: 'Coperti del tavolo' })).toContainText('2')

    // Il cliente ordina tartare di salmone (6,00 €), tiramisù (5,00 €) e Coca Cola (2,00 €).
    const tel = await apriTelefono(browser)
    await tel.goto(`/tavolo/${TAVOLO.chiave}`)
    await tel.getByLabel('Codice del tavolo').fill(codice)
    await tel.getByRole('button',{ name: 'Entra al tavolo' }).click()
    for (const [sezione,nome] of [['tartare','Salmone'],['dessert','Tiramisù'],['beverage','Coca Cola']]) await tel.locator(`#sez-${sezione}`).getByRole('button',{ name: `Aggiungi ${nome}`,exact: true }).click()
    await tel.getByRole('button',{ name: /^Rivedi e manda in cucina · 3 piatti/ }).click()
    await tel.getByRole('button',{ name: 'Invia ordine' }).click()
    await expect(tel.getByRole('status').filter({ hasText: /^Ordine n\. \d+ inviato in cucina$/ })).toBeVisible()

    // Due biglietti (banco e cucina), la bibita resta alla sala. Il ponte li stampa.
    expect(await ponte()).toBe(2)
    const biglietti = readdirSync(cartella).filter(f => f.endsWith('.txt')).map(f => readFileSync(path.join(cartella,f),'utf8'))
    expect(biglietti.find(b => b.includes('BANCO SUSHI'))).toContain('1 x 1 Salmone')
    expect(biglietti.find(b => b.includes('CUCINA'))).toContain('Tiramis')
    expect(biglietti.join('\n')).not.toContain('Coca Cola\n')

    // Le comande stampate sono «su carta» in «Da portare»: la sala le porta.
    await scheda(cassa,'Ordini')
    const striscia = cassa.getByRole('region',{ name: /^Da portare al tavolo/ })
    await expect(striscia).toContainText('Banco sushi, su carta')
    await expect(striscia).toContainText('Cucina, su carta')
    for (let n = 3; n > 0; n--) { await striscia.getByRole('button',{ name: /^Portate/ }).first().click(); await expect(striscia.getByRole('button',{ name: /^Portate/ })).toHaveCount(n - 1) }

    // Conto: 13,00 € di piatti + 2 coperti da 2,00 €.
    await scheda(cassa,'Tavoli')
    await cassa.getByRole('complementary',{ name: `Dettaglio di ${TAVOLO.nome}` }).getByRole('link',{ name: 'Apri il conto' }).click()
    await cassa.waitForURL('**/staff/conto/**')
    await expect(cassa.getByLabel('Totale: 17,00 €')).toBeVisible()
    await expect(cassa.getByRole('cell',{ name: /Coperto/ })).toBeVisible()

    // Pre-conto diviso per 2 alla stampante della cassa.
    await cassa.getByRole('button',{ name: 'Pre-conto' }).click()
    const pannello = cassa.getByRole('dialog',{ name: 'Pre-conto' })
    await pannello.getByLabel('Scrivi la quota a testa').check()
    await pannello.getByRole('button',{ name: 'Stampa il pre-conto' }).click()
    await expect(cassa.getByText(/^Pre-conto stampato alle/)).toBeVisible()
    expect(await ponte()).toBe(1)
    const preconto = readdirSync(cartella).filter(f => f.includes('-preconto-') && f.endsWith('.txt')).map(f => readFileSync(path.join(cartella,f),'utf8'))[0]
    expect(preconto).toContain('PRECONTO'); expect(preconto).toContain('8,50 € a testa'); expect(preconto).toContain('DOCUMENTO NON FISCALE')

    // Alla romana in due: contanti e carta, con lo scontrino (spunta già attiva dall'admin).
    for (const metodo of ['Contanti','Carta']) {
      await cassa.getByRole('button',{ name: 'Incassa' }).click()
      const incassa = cassa.getByRole('dialog',{ name: 'Incassa' })
      await incassa.getByRole('button',{ name: 'Alla romana' }).click()
      await expect(incassa.getByLabel('Emetti lo scontrino')).toBeChecked()
      // Dopo la prima quota il pannello ha già scalato le persone che devono pagare (2 → 1).
      await expect(incassa.getByRole('group',{ name: 'Persone' })).toContainText(metodo === 'Contanti' ? '2' : '1')
      await expect(incassa).toContainText('Da incassare 8,50')
      await foto(cassa,`incasso-${metodo.toLowerCase()}`)
      await incassa.getByRole('button',{ name: metodo,exact: true }).click()
      await expect(cassa.getByText(/Incassati 8,50/).first()).toBeVisible()
      await cassa.keyboard.press('Escape')
    }
    await expect(cassa.getByText('Saldato')).toBeVisible()
    await expect(cassa.getByText('Scontrino in stampa')).toHaveCount(2)
    expect(await ponte()).toBe(2)
    await cassa.reload()
    await expect(cassa.getByText('Scontrino di prova')).toHaveCount(2)
    await foto(cassa,'conto-saldato')
    const xml = readdirSync(cartella).filter(f => f.endsWith('.xml')).map(f => readFileSync(path.join(cartella,f),'utf8'))
    expect(xml).toHaveLength(2)
    for (const x of xml) { expect(x).toContain('<printerFiscalReceipt>'); expect(x).toContain('payment="8.50"') }

    // Tutto servito e pagato: il tavolo si chiude senza domande.
    await cassa.getByRole('button',{ name: 'Chiudi tavolo' }).click()
    await expect(cassa.getByText(/^Tavolo chiuso alle/)).toBeVisible()

    // Admin: un vino nuovo compare nella carta dei vini del menù pubblico.
    await cassa.goto('/admin/menu/nuovo?categoria=vini')
    await cassa.getByLabel('Nome',{ exact: true }).fill('Falanghina e2e')
    await cassa.getByLabel('Prezzo (€)').fill('22')
    await cassa.getByLabel('Tipologia').selectOption('bianco')
    await cassa.getByLabel('Cantina').fill('Cantina di prova')
    await cassa.getByLabel('Annata').fill('2024')
    await cassa.getByLabel(/Ho verificato gli allergeni/).check()
    await cassa.getByRole('button',{ name: 'Aggiungi al menù' }).click()
    await cassa.waitForURL(/\/admin\/menu\/[0-9a-f-]{36}$/)
    await cassa.goto('/')
    const carta = cassa.locator('#sez-vini')
    await expect(carta.getByRole('heading',{ name: 'Carta dei vini' })).toBeVisible()
    await expect(carta).toContainText('Bianchi'); await expect(carta).toContainText('Falanghina e2e'); await expect(carta).toContainText('Cantina di prova · 2024')
    if (process.env.E2E_FOTO) await carta.screenshot({ path: 'test-results/foto/carta-vini.png' })
    await cassa.goto('/admin/cassa'); await foto(cassa,'admin-cassa')
  } finally {
    // Le altre prove lavorano dallo schermo: si torna come prima.
    await db.query('update impostazioni_cassa set coperto_cent=0,stampa_banco=false,stampa_cucina=false,scontrino_automatico=false')
    await db.query(`delete from piatti where nome='Falanghina e2e'`)
    await db.end()
    rmSync(cartella,{ recursive: true,force: true })
  }
})
