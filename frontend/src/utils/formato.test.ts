import { describe, expect, it } from 'vitest'

import { aIso, diaRelativo, fechaLarga, iniciales, plata, sumarDias, desdeIso } from './formato'

describe('plata', () => {
  it('sin centavos cuando es un número redondo', () => {
    expect(plata('85000.00')).toMatch(/^\$\s?85\.000$/)
  })

  it('con centavos cuando los tiene', () => {
    expect(plata('6666.60')).toMatch(/^\$\s?6\.666,60$/)
  })
})

describe('fechas', () => {
  it('ida y vuelta sin corrimientos de zona horaria', () => {
    expect(aIso(desdeIso('2026-10-03'))).toBe('2026-10-03')
    expect(aIso(sumarDias(desdeIso('2026-10-31'), 1))).toBe('2026-11-01')
  })

  it('hoy, mañana o el día', () => {
    expect(diaRelativo('2026-09-29', '2026-09-29')).toBe('hoy')
    expect(diaRelativo('2026-09-30', '2026-09-29')).toBe('mañana')
    expect(diaRelativo('2026-10-03', '2026-09-29')).toBe('sábado')
  })

  it('fecha larga', () => {
    expect(fechaLarga('2026-10-03')).toBe('Sábado 3 de octubre')
  })
})

describe('iniciales', () => {
  it('toma las primeras letras de las palabras importantes', () => {
    expect(iniciales('El Potrero')).toBe('PO')
    expect(iniciales('Pádel Norte')).toBe('PN')
    expect(iniciales('Garage Fútbol 5')).toBe('GF')
  })
})
