import { describe, expect, it } from 'vitest'

import { consultaMaps, urlComoLlegar, urlMapaEmbebido, urlVerEnMaps } from './mapas'

describe('mapas', () => {
  it('arma la búsqueda con dirección, barrio y país', () => {
    expect(consultaMaps({ direccion: 'Av. Triunvirato 4820', barrio: 'Villa Urquiza' })).toBe(
      'Av. Triunvirato 4820, Villa Urquiza, Argentina',
    )
    expect(consultaMaps({ direccion: 'Bulnes 780', barrio: null })).toBe('Bulnes 780, Argentina')
  })

  it('sin dirección no hay mapa', () => {
    expect(consultaMaps({ direccion: null, barrio: 'Palermo' })).toBeNull()
  })

  it('usa las URLs oficiales de Google Maps', () => {
    expect(urlComoLlegar('Bulnes 780, Argentina')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Bulnes%20780%2C%20Argentina',
    )
    expect(urlVerEnMaps('Bulnes 780')).toBe('https://www.google.com/maps/search/?api=1&query=Bulnes%20780')
    expect(urlMapaEmbebido('Bulnes 780', 'CLAVE')).toBe(
      'https://www.google.com/maps/embed/v1/place?key=CLAVE&q=Bulnes+780&language=es&region=AR',
    )
  })
})
