import { describe, expect, it } from 'vitest'
import { allaRomana, chiaveVoce, metodoValido, porzioniResidue, quotaPerPiatti, sommaPagati, type VoceDivisibile } from './divisione-conto'

describe('alla romana', () => {
  it('le quote sommano esattamente il totale e differiscono al più di un centesimo', () => {
    for (const [totale,persone] of [[10000,4],[10001,3],[1,3],[0,2],[9999,7],[123457,50],[500,1]] as const) {
      const quote = allaRomana(totale,persone)
      expect(quote).toHaveLength(persone)
      expect(quote.reduce((s,q) => s + q,0)).toBe(totale)
      expect(Math.max(...quote) - Math.min(...quote)).toBeLessThanOrEqual(1)
    }
    expect(allaRomana(10001,3)).toEqual([3334,3334,3333])
    expect(allaRomana(100,3)).toEqual([34,33,33])
  })
  it('pagando una quota alla volta sul residuo si arriva a zero', () => {
    let residuo = 10001
    const pagate: number[] = []
    for (let rimaste = 3; rimaste > 0; rimaste--) { const q = allaRomana(residuo,rimaste)[0]; pagate.push(q); residuo -= q }
    expect(residuo).toBe(0)
    expect(pagate).toEqual([3334,3334,3333])
  })
  it('rifiuta persone e totali fuori scala', () => {
    for (const [t,p] of [[100,0],[100,51],[100,1.5],[-1,2],[1.5,2]]) expect(() => allaRomana(t,p)).toThrow()
  })
})

describe('per piatti', () => {
  const nigiri: VoceDivisibile = { numero: 12,nome: 'Nigiri salmone',prezzoUnitCent: 450,poke: null,quantita: 3 }
  const poke: VoceDivisibile = { numero: null,nome: 'Poke composta',prezzoUnitCent: 1200,poke: { Base: ['Riso'] },quantita: 1 }
  const voci = [nigiri,poke]
  const conto = { coperti: 2,copertoCent: 200 }
  const niente = sommaPagati([])
  it('somma porzioni scelte e coperti, anche una porzione di una voce da tre', () => {
    expect(quotaPerPiatti(voci,conto,niente,[{ chiave: chiaveVoce(nigiri),quantita: 1 }],1)).toEqual({ ok: true,importoCent: 650,coperti: 1,
      porzioni: [{ chiave: chiaveVoce(nigiri),quantita: 1,nome: 'Nigiri salmone',numero: 12,prezzoUnitCent: 450 }] })
    expect(quotaPerPiatti(voci,conto,niente,[{ chiave: chiaveVoce(poke),quantita: 1 },{ chiave: chiaveVoce(nigiri),quantita: 2 }],0)).toMatchObject({ ok: true,importoCent: 2100 })
  })
  it('non fa pagare due volte le stesse porzioni né gli stessi coperti', () => {
    const pagato = sommaPagati([{ porzioni: [{ chiave: chiaveVoce(nigiri),quantita: 2 }],coperti: 2 }])
    expect(porzioniResidue(voci,pagato)).toEqual([{ chiave: chiaveVoce(nigiri),residue: 1 },{ chiave: chiaveVoce(poke),residue: 1 }])
    expect(quotaPerPiatti(voci,conto,pagato,[{ chiave: chiaveVoce(nigiri),quantita: 2 }],0)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,conto,pagato,[{ chiave: chiaveVoce(nigiri),quantita: 1 }],1)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,conto,pagato,[{ chiave: chiaveVoce(nigiri),quantita: 1 }],0)).toMatchObject({ ok: true,importoCent: 450 })
  })
  it('le porzioni pagate e poi annullate non vanno sotto zero', () => {
    const pagato = sommaPagati([{ porzioni: [{ chiave: chiaveVoce(nigiri),quantita: 3 }],coperti: 0 }])
    expect(porzioniResidue([{ ...nigiri,quantita: 1 }],pagato)).toEqual([{ chiave: chiaveVoce(nigiri),residue: 0 }])
  })
  it('rifiuta scelte vuote, voci sconosciute e valori sbagliati', () => {
    expect(quotaPerPiatti(voci,conto,niente,[],0)).toMatchObject({ ok: false,errore: 'Scegli almeno un piatto.' })
    expect(quotaPerPiatti(voci,conto,niente,[{ chiave: 'altro',quantita: 1 }],0)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,conto,niente,[{ chiave: chiaveVoce(nigiri),quantita: -1 }],0)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,conto,niente,[{ chiave: chiaveVoce(nigiri),quantita: 1.5 }],0)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,conto,niente,[],-1)).toMatchObject({ ok: false })
    expect(quotaPerPiatti(voci,{ coperti: null,copertoCent: null },niente,[],1)).toMatchObject({ ok: false })
  })
  it('due persone che si dividono tutto per piatti pagano esattamente il conto', () => {
    const a = quotaPerPiatti(voci,conto,niente,[{ chiave: chiaveVoce(nigiri),quantita: 2 }],1)
    if (!a.ok) throw new Error(a.errore)
    const dopo = sommaPagati([{ porzioni: a.porzioni,coperti: a.coperti }])
    const b = quotaPerPiatti(voci,conto,dopo,[{ chiave: chiaveVoce(nigiri),quantita: 1 },{ chiave: chiaveVoce(poke),quantita: 1 }],1)
    if (!b.ok) throw new Error(b.errore)
    expect(a.importoCent + b.importoCent).toBe(3 * 450 + 1200 + 2 * 200)
  })
})

it('metodi di pagamento', () => {
  expect(metodoValido('contanti')).toBe(true); expect(metodoValido('carta')).toBe(true)
  expect(metodoValido('assegno')).toBe(false); expect(metodoValido(undefined)).toBe(false)
})
