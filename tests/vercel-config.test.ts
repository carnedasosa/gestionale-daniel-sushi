import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// Le funzioni girano a Francoforte, accanto al database Supabase (eu-central-1); senza regione Vercel usa iad1.
it('vercel.json: regione fra1 e cron di anonimizzazione', () => {
  const config = JSON.parse(readFileSync('vercel.json','utf8'))
  expect(config.regions).toEqual(['fra1'])
  expect(config.crons).toEqual([{ path: '/api/cron/anonimizza',schedule: '0 3 * * *' }])
})
