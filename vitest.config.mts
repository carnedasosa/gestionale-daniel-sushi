import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' lancia un errore fuori dai Server Components: nei test va neutralizzato
      'server-only': fileURLToPath(new URL('./tests/stub-vuoto.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // I test con PGlite (~1,5 s a test, ~7 s a file) superano i 5 s di default quando i file girano in parallelo.
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
