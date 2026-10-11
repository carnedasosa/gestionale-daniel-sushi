import { eAllergene, normalizzaAllergeni } from '@/domain/allergeni'
import { parseEuro } from '@/domain/soldi'
import type { DatiPiatto } from './repo'

export interface InputPiatto {
  nome: string
  descrizione: string
  prezzo: string
  piccante: boolean
  vegetariano: boolean
  dellaCasa: boolean
  allergeni: string[]
  allergeniConfermati: boolean
}

type Esito = { ok: true; dati: DatiPiatto } | { ok: false; errori: Partial<Record<keyof InputPiatto, string>> }

export function validaPiatto(input: InputPiatto): Esito {
  const errori: Partial<Record<keyof InputPiatto, string>> = {}
  const nome = input.nome.trim()
  const descrizione = input.descrizione.trim()
  const prezzoCent = parseEuro(input.prezzo)

  if (!nome) errori.nome = 'Il nome è obbligatorio'
  else if (nome.length > 120) errori.nome = 'Massimo 120 caratteri'
  if (descrizione.length > 500) errori.descrizione = 'Massimo 500 caratteri'
  if (prezzoCent === null) errori.prezzo = 'Scrivi il prezzo in euro, ad esempio 10,50'
  if (!input.allergeni.every(eAllergene)) errori.allergeni = 'Allergene non valido'

  if (Object.keys(errori).length > 0) return { ok: false, errori }
  return {
    ok: true,
    dati: {
      nome,
      descrizione: descrizione || null,
      prezzoCent: prezzoCent!,
      piccante: input.piccante,
      vegetariano: input.vegetariano,
      dellaCasa: input.dellaCasa,
      allergeni: normalizzaAllergeni(input.allergeni),
      allergeniConfermati: input.allergeniConfermati,
    },
  }
}

export function inputDaForm(fd: FormData): InputPiatto {
  const testo = (k: string) => String(fd.get(k) ?? '')
  const spunta = (k: string) => fd.get(k) === 'on'
  return {
    nome: testo('nome'),
    descrizione: testo('descrizione'),
    prezzo: testo('prezzo'),
    piccante: spunta('piccante'),
    vegetariano: spunta('vegetariano'),
    dellaCasa: spunta('dellaCasa'),
    allergeni: fd.getAll('allergeni').map(String),
    allergeniConfermati: spunta('allergeniConfermati'),
  }
}
