import { expect, test } from '@playwright/test'
import { apriSchermoStaff } from './aiuti'

test('dopo il login la sessione non è leggibile da JavaScript e resta valida nelle pagine protette', async ({ browser }) => {
  const staff = await apriSchermoStaff(browser)
  const sessione = (await staff.context().cookies()).filter(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  expect(sessione.length).toBeGreaterThan(0)
  for (const c of sessione) expect(c).toMatchObject({ httpOnly: true,secure: true,sameSite: 'Lax' })
  expect(await staff.evaluate(() => document.cookie)).not.toContain('auth-token')
  // Il proxy e richiediRuolo leggono ancora il cookie: la pagina protetta si apre senza tornare al login.
  await staff.goto('/admin/menu')
  await expect(staff).toHaveURL(/\/admin\/menu$/)
  await staff.context().close()
})

test('header di sicurezza e nessuna violazione della CSP sulle pagine vere, stampa dei QR compresa', async ({ browser }) => {
  const staff = await apriSchermoStaff(browser)
  const violazioni: string[] = []
  staff.on('console',m => { if (m.text().includes('Content Security Policy')) violazioni.push(`${staff.url()}: ${m.text()}`) })
  for (const percorso of ['/','/accesso','/admin','/admin/menu','/admin/tavoli','/admin/tavoli/stampa','/staff']) {
    const risposta = await staff.goto(percorso)
    expect(risposta?.ok(),percorso).toBe(true)
    const h = risposta!.headers()
    expect(h['x-frame-options'],percorso).toBe('DENY')
    expect(h['x-content-type-options'],percorso).toBe('nosniff')
    expect(h['referrer-policy'],percorso).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy'],percorso).toContain('camera=()')
    expect(h['content-security-policy-report-only'],percorso).toContain("default-src 'self'")
    expect(h['x-powered-by'],percorso).toBeUndefined()
    await staff.waitForLoadState('networkidle')
  }
  expect(violazioni).toEqual([])
  // Controprova: una richiesta verso un altro sito viene segnalata, quindi il silenzio qui sopra vuol dire qualcosa.
  await staff.evaluate(() => fetch('https://esempio.invalid/').catch(() => {}))
  await expect.poll(() => violazioni.length).toBeGreaterThan(0)
  await staff.context().close()
})
