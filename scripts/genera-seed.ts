// Uso: npm run seed [-- percorso/menu.json]   (default: data/menu-sito.json)
import { readFileSync, writeFileSync } from 'node:fs'
import { convertiMenu, type MenuJson } from '../src/menu/importa'
import { generaSeedSql } from '../src/menu/seed-sql'

const sorgente = process.argv[2] ?? 'data/menu-sito.json'
const menu = convertiMenu(JSON.parse(readFileSync(sorgente, 'utf8')) as MenuJson)
writeFileSync('supabase/seed.sql', generaSeedSql(menu), 'utf8')
console.log(`seed.sql: ${menu.categorie.length} categorie, ${menu.piatti.length} piatti, poke ${menu.poke ? 'sì' : 'no'}`)
