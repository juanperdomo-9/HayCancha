import { expect, test } from 'vitest'
import { limpiarDireccion, ubicacionDeLinkDeMaps } from './mapas'

test('limpia lo que confunde al buscador', () => {
  expect(limpiarDireccion('Calle 528 N° 1150, Tolosa, Argentina')).toBe('Calle 528 1150, Tolosa, Argentina')
  expect(limpiarDireccion('Calle 7 nro. 1234 entre 50 y 51, La Plata')).toBe('Calle 7 1234, La Plata')
  expect(limpiarDireccion('Av. Centro 300, Lanús')).toBe('Av. Centro 300, Lanús')
})

test('saca la ubicación de un link de Google Maps', () => {
  const lugar = 'https://www.google.com/maps/place/X/@-34.9,-57.95,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-34.899512!4d-57.969034'
  expect(ubicacionDeLinkDeMaps(lugar)).toEqual({ latitud: -34.899512, longitud: -57.969034 })
  expect(ubicacionDeLinkDeMaps('https://www.google.com/maps/@-34.92,-57.95,15z')).toEqual({ latitud: -34.92, longitud: -57.95 })
  expect(ubicacionDeLinkDeMaps('https://maps.app.goo.gl/abc')).toBeNull()
  expect(ubicacionDeLinkDeMaps('https://www.google.com/maps/@40.7,-74.0,15z')).toBeNull()
})
