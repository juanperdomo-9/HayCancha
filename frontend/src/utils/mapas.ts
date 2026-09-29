/** Links a Google Maps. "Cómo llegar" y "Ver en Google Maps" usan las URLs oficiales de
 * Maps (sin clave); el mapa embebido usa la Maps Embed API (gratis, con clave). */

type Ubicacion = { direccion: string | null; barrio: string | null }

/** Lo que se busca en Maps: "Av. Triunvirato 4820, Villa Urquiza, Argentina". */
export function consultaMaps({ direccion, barrio }: Ubicacion): string | null {
  if (!direccion) return null
  return [direccion, barrio, 'Argentina'].filter(Boolean).join(', ')
}

export function urlComoLlegar(consulta: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(consulta)}`
}

export function urlVerEnMaps(consulta: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
}

export function urlMapaEmbebido(consulta: string, clave: string): string {
  const parametros = new URLSearchParams({ key: clave, q: consulta, language: 'es', region: 'AR' })
  return `https://www.google.com/maps/embed/v1/place?${parametros}`
}
