import type { MenuConvertito } from './importa'

function lit(v: string | number | boolean | null): string {
  if (v === null) return 'null'
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new Error(`Numero non intero nel seed: ${v}`)
    return String(v)
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return `'${v.replace(/'/g, "''")}'`
}

export function generaSeedSql(menu: MenuConvertito): string {
  const righe: string[] = ['-- Generato da scripts/genera-seed.ts: non modificare a mano.', 'begin;']

  righe.push(
    'insert into public.categorie (id, nome, pezzi, posizione, reparto) values',
    menu.categorie.map((c) => `  (${lit(c.id)}, ${lit(c.nome)}, ${lit(c.pezzi)}, ${lit(c.posizione)}, ${lit(c.reparto)})`).join(',\n') + ';',
  )

  righe.push(
    'insert into public.piatti (categoria_id, numero, nome, descrizione, prezzo_cent, piccante, vegetariano, della_casa, posizione) values',
    menu.piatti
      .map((p) =>
        `  (${[p.categoria_id, p.numero, p.nome, p.descrizione, p.prezzo_cent, p.piccante, p.vegetariano, p.della_casa, p.posizione].map(lit).join(', ')})`,
      )
      .join(',\n') + ';',
  )

  if (menu.poke) {
    righe.push(
      'insert into public.poke_config (id, titolo, gruppi, prezzo_base_cent, prezzo_extra_cent) values',
      `  (1, ${lit(menu.poke.titolo)}, ${lit(JSON.stringify(menu.poke.gruppi))}::jsonb, ${lit(menu.poke.prezzoBaseCent)}, ${lit(menu.poke.prezzoExtraCent)});`,
    )
  }

  righe.push('commit;', '')
  return righe.join('\n')
}
