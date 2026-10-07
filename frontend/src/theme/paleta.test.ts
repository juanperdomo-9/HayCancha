import { describe, expect, it } from 'vitest'

import {
  COLOR_POR_DEFECTO,
  CONTRASTE_TEXTO,
  FONDO_BASE,
  contraste,
  normalizarHex,
  temaComplejo,
} from './paleta'

// Colores que un dueño podría elegir, incluidos los difíciles (claros y chillones).
const COLORES = ['#1F8A4C', '#2447D8', '#F2C200', '#C4552B', '#7B3FE4', '#D42A3C', '#F7B5CA', '#EDEDED', '#FFFFFF', '#000000', '#00E5FF']

describe('contraste', () => {
  it('negro sobre blanco es 21:1', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
  })

  it('es simétrico', () => {
    expect(contraste('#1F8A4C', '#F6F4EF')).toBeCloseTo(contraste('#F6F4EF', '#1F8A4C'), 10)
  })
})

describe('normalizarHex', () => {
  it('acepta 3 y 6 dígitos, con o sin #', () => {
    expect(normalizarHex('#abc')).toBe('#AABBCC')
    expect(normalizarHex('1f8a4c')).toBe('#1F8A4C')
  })

  it('rechaza lo que no es un color', () => {
    expect(normalizarHex('verde')).toBeNull()
    expect(normalizarHex('#12345')).toBeNull()
  })
})

describe('temaComplejo', () => {
  it.each(COLORES)('%s: el texto encima del color se lee', (color) => {
    const tema = temaComplejo(color)
    expect(contraste(tema.sobre, tema.complejo)).toBeGreaterThanOrEqual(3)
  })

  it.each(COLORES)('%s: el texto del color sobre el fondo base cumple 4.5:1', (color) => {
    const tema = temaComplejo(color)
    expect(contraste(tema.texto, FONDO_BASE)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
  })

  it('usa texto oscuro sobre amarillo y blanco sobre azul', () => {
    expect(temaComplejo('#F2C200').sobre).toBe('#15161A')
    expect(temaComplejo('#2447D8').sobre).toBe('#FFFFFF')
  })

  it('no toca un color que ya tiene buen contraste', () => {
    expect(temaComplejo('#2447D8').texto).toBe('#2447D8')
  })

  it('oscurece el amarillo para usarlo como texto', () => {
    const tema = temaComplejo('#F2C200')
    expect(tema.texto).not.toBe('#F2C200')
    expect(contraste(tema.texto, FONDO_BASE)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO)
  })

  it('con un color inválido usa el de HayCanchas', () => {
    expect(temaComplejo('cualquier cosa').complejo).toBe(COLOR_POR_DEFECTO)
  })

  it('sin color secundario usa el principal', () => {
    expect(temaComplejo('#2447D8').secundario).toBe('#2447D8')
    expect(temaComplejo('#2447D8', '#f2c200').secundario).toBe('#F2C200')
  })
})
