/** De dónde vino el jugador: si entró a un complejo desde la página principal de HayCancha
 * (listado, mapa o buscador), los links llevan `?via=haycancha` y la página del complejo lo
 * recuerda durante la visita. Solo sirve para las métricas del complejo. */
export const VIA_HAYCANCHA = 'via=haycancha'

const clave = (slug: string) => `llegada:${slug}`

export function recordarLlegada(slug: string, parametros: URLSearchParams) {
  if (parametros.get('via') !== 'haycancha') return
  try {
    sessionStorage.setItem(clave(slug), 'haycancha')
  } catch {
    // Sin almacenamiento (modo privado estricto): la reserva cuenta como directa.
  }
}

export function llegadaDe(slug: string): 'haycancha' | 'directo' {
  try {
    return sessionStorage.getItem(clave(slug)) === 'haycancha' ? 'haycancha' : 'directo'
  } catch {
    return 'directo'
  }
}
