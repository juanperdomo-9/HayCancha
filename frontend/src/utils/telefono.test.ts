import { describe, expect, it } from 'vitest'

import { numeroWhatsapp, urlLlamar } from './telefono'

describe('numeroWhatsapp', () => {
  it.each([
    ['11 5555-1234', '5491155551234'],
    ['011 15 5555 1234', '5491155551234'],
    ['+54 9 11 5555 1234', '5491155551234'],
    ['+54 11 5555 1234', '5491155551234'],
    ['0351 15 555 1234', '5493515551234'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(numeroWhatsapp(entrada)).toBe(esperado)
  })

  it('para llamar usa el formato internacional sin el 9', () => {
    expect(urlLlamar('11 5555-1234')).toBe('tel:+541155551234')
  })
})
