/** Links a Google Maps. "Cómo llegar" y "Ver en Google Maps" usan las URLs oficiales de
 * Maps (sin clave). El mapa embebido usa la Maps Embed API si hay clave (VITE_GOOGLE_MAPS_KEY);
 * si no, el mapa embebible clásico de Google, que no pide clave. */

type Ubicacion = { direccion: string | null; barrio: string | null }

/** Lo que se busca en Maps: "Av. Triunvirato 4820, Villa Urquiza, Argentina". */
export function consultaMaps({ direccion, barrio }: Ubicacion): string | null {
  if (!direccion) return null
  return [direccion, barrio, 'Argentina'].filter(Boolean).join(', ')
}

/** Lo que confunde al buscador de OpenStreetMap: "N° 1150", "nro. 1150", "entre 7 y 8". */
export function limpiarDireccion(direccion: string): string {
  return direccion
    .replace(/\s+entre\s+[^,]+?\s+y\s+[^,]+/gi, '')
    .replace(/(?<![a-záéíóúñ])(n[°º]|nro\.?|n[uú]mero)\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Coordenadas de un link de Google Maps (el largo, de la barra de direcciones). */
export function ubicacionDeLinkDeMaps(link: string): { latitud: number; longitud: number } | null {
  const lugar = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) // el punto exacto del lugar
  const consulta = link.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  const centro = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  const m = lugar ?? consulta ?? centro
  if (!m) return null
  const latitud = +(+m[1]).toFixed(6)
  const longitud = +(+m[2]).toFixed(6)
  // Argentina, más o menos: evita coordenadas al revés o de otro lado.
  if (latitud > -21 || latitud < -56 || longitud > -53 || longitud < -74) return null
  return { latitud, longitud }
}

export function urlComoLlegar(consulta: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(consulta)}`
}

export function urlVerEnMaps(consulta: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
}

export function urlMapaEmbebido(consulta: string, clave?: string): string {
  if (!clave) {
    const parametros = new URLSearchParams({ q: consulta, hl: 'es', z: '16', output: 'embed' })
    return `https://maps.google.com/maps?${parametros}`
  }
  const parametros = new URLSearchParams({ key: clave, q: consulta, language: 'es', region: 'AR' })
  return `https://www.google.com/maps/embed/v1/place?${parametros}`
}
