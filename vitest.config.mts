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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
