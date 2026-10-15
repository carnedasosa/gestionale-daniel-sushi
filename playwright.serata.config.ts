import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Simulazione di una serata (npm run serata): lunga, quindi fuori da npm run e2e.
// Ogni azione ha 15 s al massimo: un pulsante che non arriva diventa un errore, non un'attesa infinita.
export default defineConfig({ ...base,testMatch: 'serata.spec.ts',testIgnore: [],use: { ...base.use,trace: 'off',actionTimeout: 15_000 } })
