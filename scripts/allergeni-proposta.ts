// Uso: npx tsx scripts/allergeni-proposta.ts
// Genera da src/menu/allergeni-proposta.ts:
// - docs/allergeni/scheda-allergeni.html: la scheda da stampare e verificare con Daniel;
// - docs/allergeni/proposta-allergeni.sql: carica le proposte senza confermarle.
//   Tocca solo piatti mai compilati (allergeni vuoti e non confermati): non sovrascrive il lavoro di Daniel.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { etichettaAllergene } from '../src/domain/allergeni'
import { convertiMenu, type MenuJson } from '../src/menu/importa'
import { allergeniPokeProposti, INGREDIENTI, PROPOSTA_POKE, risolviProposta, sqlProposta, type ChiaveIngrediente } from '../src/menu/allergeni-proposta'

const menu = convertiMenu(JSON.parse(readFileSync('data/menu-sito.json','utf8')) as MenuJson)
const piatti = risolviProposta()
const voci = allergeniPokeProposti(menu.poke!.gruppi)
const sql = sqlProposta(menu.poke!.gruppi)

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const etichette = (codici: Parameters<typeof etichettaAllergene>[0][]) => codici.length ? codici.map(c => esc(etichettaAllergene(c))).join(', ') : '<em>nessuno</em>'
const nomeCategoria = new Map(menu.categorie.map(c => [c.id,c.nome]))

// Domande sugli ingredienti: una risposta vale per tutti i piatti che li usano.
const usi = new Map<ChiaveIngrediente,string[]>()
for (const p of piatti) for (const i of p.ingredienti) if (INGREDIENTI[i].domanda) usi.set(i,[...(usi.get(i) ?? []),p.numero !== null ? `n. ${p.numero}` : p.nome])
for (const [,lista] of Object.entries(PROPOSTA_POKE)) for (const [v,ingr] of Object.entries(lista)) for (const i of ingr) if (INGREDIENTI[i].domanda) usi.set(i,[...(usi.get(i) ?? []),`poke: ${v}`])
const domandeIngredienti = [...usi.entries()].sort((a,b) => b[1].length - a[1].length)

const righePiatti = menu.categorie.map(c => {
  const lista = piatti.filter(p => p.categoria === c.id)
  return `<h3>${esc(c.nome)}</h3>
<table><thead><tr><th>N.</th><th>Piatto</th><th>Allergeni proposti</th><th>Dubbi (vedi parte 1)</th><th>Ok</th></tr></thead><tbody>
${lista.map(p => {
    const dubbi = p.ingredienti.filter(i => INGREDIENTI[i].domanda)
    const specifica = p.domande.filter(d => !dubbi.some(i => INGREDIENTI[i].domanda === d))
    return `<tr><td>${p.numero ?? ''}</td><td>${esc(p.nome)}</td><td>${etichette(p.allergeni)}</td><td class="dubbi">${[...dubbi.map(esc),...specifica.map(d => `<strong>${esc(d)}</strong>`)].join(' · ')}</td><td class="ok">☐</td></tr>`
  }).join('\n')}
</tbody></table>`
}).join('\n')

const righePoke = Object.entries(voci).map(([g,lista]) => `<h3>${esc(g)}</h3>
<table><thead><tr><th>Ingrediente</th><th>Allergeni proposti</th><th>Dubbi</th><th>Ok</th></tr></thead><tbody>
${Object.entries(lista).map(([v,codici]) => `<tr><td>${esc(v)}</td><td>${etichette(codici)}</td><td class="dubbi">${PROPOSTA_POKE[g][v].filter(i => INGREDIENTI[i].domanda).map(esc).join(' · ')}</td><td class="ok">☐</td></tr>`).join('\n')}
</tbody></table>`).join('\n')

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Allergeni da verificare</title>
<style>
body { font: 14px/1.45 system-ui, sans-serif; color: #1d1d1b; background: #fff; max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 32px 0 8px; border-bottom: 2px solid #1d1d1b; padding-bottom: 4px; } h3 { font-size: 15px; margin: 20px 0 6px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; } th, td { border: 1px solid #c9c6bd; padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #f2f0ea; font-size: 12px; } td.ok { width: 34px; text-align: center; font-size: 18px; } td.dubbi { font-size: 12px; color: #55524a; } td.dubbi strong { color: #1d1d1b; }
.nota { background: #fff7e0; border: 1px solid #e0c870; padding: 10px 12px; } .risposta { min-width: 160px; }
@media print { body { padding: 0; font-size: 11px; } h2 { break-before: page; } h2.prima { break-before: auto; } tr { break-inside: avoid; } }
</style></head><body>
<h1>Allergeni da verificare con Daniel</h1>
<p>Proposta generata il 14/10/2026 dagli ingredienti scritti nel menù: ${piatti.length} piatti e ${Object.values(voci).reduce((n,l) => n + Object.keys(l).length,0)} ingredienti della poke composta.</p>
<div class="nota"><p><strong>È una bozza, non un dato verificato.</strong> I clienti non la vedono: finché un piatto non è spuntato leggono «Allergeni in verifica: chiedi al personale».</p>
<p><strong>Come confermare:</strong> Admin › Menù › scheda «Allergeni da confermare» › apri il piatto › correggi le caselle degli allergeni › spunta «Ho verificato gli allergeni di questo piatto» › «Salva il piatto».
Per la poke: Admin › Poke › «Allergeni degli ingredienti» › correggi › spunta «Ho verificato gli allergeni di tutti gli ingredienti» › «Salva allergeni».</p>
<p>Conviene partire dalla parte 1: una risposta sulla teriyaki, sulla maionese o sulla tempura sistema decine di piatti in un colpo. Per i prodotti pronti (dolci, involtini, gyoza, surimi, salse) decide l’etichetta della confezione.</p></div>

<h2 class="prima">Parte 1 · Domande sugli ingredienti (${domandeIngredienti.length})</h2>
<table><thead><tr><th>Ingrediente</th><th>Proposta</th><th>Domanda</th><th>Piatti</th><th class="risposta">Risposta di Daniel</th></tr></thead><tbody>
${domandeIngredienti.map(([i,dove]) => `<tr><td><strong>${esc(i)}</strong></td><td>${etichette(INGREDIENTI[i].allergeni)}</td><td>${esc(INGREDIENTI[i].domanda!)}</td><td class="dubbi">${dove.length} · ${esc(dove.join(', '))}</td><td></td></tr>`).join('\n')}
</tbody></table>
<p class="dubbi">Da chiedere anche in generale: le fritture (tempura, patatine, gamberi) usano lo stesso olio? Taglieri e coltelli sono separati per crudo e cotto? Le tracce non sono obbligatorie per legge, ma vanno dette a chi ha un’allergia grave.</p>

<h2>Parte 2 · Piatti</h2>
${righePiatti}

<h2>Parte 3 · Poke composta: ingredienti</h2>
${righePoke}
</body></html>
`

mkdirSync('docs/allergeni',{ recursive: true })
writeFileSync('docs/allergeni/proposta-allergeni.sql',sql,'utf8')
writeFileSync('docs/allergeni/scheda-allergeni.html',html,'utf8')
console.log(`${piatti.length} piatti, ${domandeIngredienti.length} domande sugli ingredienti; scritti docs/allergeni/proposta-allergeni.sql e docs/allergeni/scheda-allergeni.html`)
console.log(`Per categoria: ${menu.categorie.map(c => `${nomeCategoria.get(c.id)} ${piatti.filter(p => p.categoria === c.id).length}`).join(', ')}`)
