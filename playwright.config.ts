import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import { PORTA_APP, PORTA_DB, URL_DB } from './e2e/dati'

// E2E_EMAIL ed E2E_PASSWORD dell'utente di prova servono ai test (login dello staff).
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

// Prove end-to-end sulla build di produzione, con il database finto di e2e/db-locale.ts.
// DATABASE_URL punta sempre a 127.0.0.1: le variabili del processo prevalgono su .env.local.
export default defineConfig({
  testDir: 'e2e',
  testIgnore: 'serata.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  // Niente registrazioni in CI: conterrebbero la password dell'utente di prova, e gli allegati di un repository pubblico sono scaricabili.
  use: { baseURL: `http://127.0.0.1:${PORTA_APP}`,locale: 'it-IT',timezoneId: 'Europe/Rome',trace: process.env.CI ? 'off' : 'retain-on-failure' },
  projects: [{ name: 'chromium',use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npx tsx --env-file=.env.local e2e/db-locale.ts',port: PORTA_DB,timeout: 120_000,reuseExistingServer: false,stdout: 'pipe' },
    { command: `npx next build && npx next start -H 127.0.0.1 -p ${PORTA_APP}`,url: `http://127.0.0.1:${PORTA_APP}/accesso`,timeout: 600_000,reuseExistingServer: false,
      env: { DATABASE_URL: URL_DB,APP_URL: `http://127.0.0.1:${PORTA_APP}` },stdout: 'pipe' },
  ],
})
