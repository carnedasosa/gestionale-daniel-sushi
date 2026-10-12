import { expect, it } from 'vitest'
import { validaChiusura, validaImpostazioni, validaOrario, validaZona } from './valida-domicilio'
it('impostazioni: capacità, consegne non oltre il totale, anticipo e telefono facoltativo', () => {
  expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '080 123 4567' }))
    .toEqual({ ok: true,dati: { capacitaFascia: 4,capacitaConsegne: 2,anticipoMinuti: 30,telefono: '0801234567' } })
  expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '0',anticipoMinuti: '0',telefono: '' })).toMatchObject({ ok: true,dati: { telefono: null } })
  for (const v of [{ capacitaFascia: '0' },{ capacitaConsegne: '5' },{ anticipoMinuti: '300' },{ telefono: '12' },{ capacitaFascia: '2.5' }])
    expect(validaImpostazioni({ capacitaFascia: '4',capacitaConsegne: '2',anticipoMinuti: '30',telefono: '',...v }).ok).toBe(false)
})
it('zona: nome, importi in euro, posizione e casella attiva', () => {
  expect(validaZona({ nome: ' Bitetto ',costo: '2',minimo: '15,00',posizione: '1',attiva: 'on' })).toEqual({ ok: true,dati: { nome: 'Bitetto',costoCent: 200,minimoCent: 1500,attiva: true,posizione: 1 } })
  expect(validaZona({ nome: 'Bitetto',costo: '0',minimo: '0' })).toMatchObject({ ok: true,dati: { attiva: false,posizione: 0 } })
  for (const v of [{ nome: '' },{ costo: '-1' },{ costo: '1001' },{ minimo: 'dieci' },{ posizione: 'primo' }])
    expect(validaZona({ nome: 'B',costo: '2',minimo: '15',posizione: '0',...v }).ok).toBe(false)
})
it('orario: servizio, giorno e inizio prima della fine', () => {
  expect(validaOrario({ servizio: 'domicilio',giorno: '5',dalle: '19:30',alle: '22:30' })).toEqual({ ok: true,dati: { servizio: 'domicilio',giorno: 5,dalle: '19:30',alle: '22:30' } })
  for (const v of [{ servizio: 'tavolo' },{ giorno: '8' },{ dalle: '23:00' },{ alle: '24:00' }])
    expect(validaOrario({ servizio: 'asporto',giorno: '1',dalle: '19:00',alle: '23:00',...v }).ok).toBe(false)
})
it('chiusura: data valida e motivo facoltativo', () => {
  expect(validaChiusura({ data: '2026-12-25',motivo: ' Natale ' })).toEqual({ ok: true,dati: { data: '2026-12-25',motivo: 'Natale' } })
  expect(validaChiusura({ data: '2026-12-25',motivo: '' })).toEqual({ ok: true,dati: { data: '2026-12-25',motivo: null } })
  expect(validaChiusura({ data: '2026-02-30' }).ok).toBe(false)
  expect(validaChiusura({ data: '2026-12-25',motivo: 'x'.repeat(101) }).ok).toBe(false)
})
